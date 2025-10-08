class HyperLogLog {
  private p: number;
  private m: number;
  private registers: Uint8Array;
  private alpha: number;

  constructor(precision = 14) {
    // 精度 p，寄存器大小 m = 2^p
    this.p = precision;
    // 寄存器的大小：2^p
    this.m = 1 << precision;
    // 寄存器(内存中一段连续的Buffer)
    this.registers = new Uint8Array(this.m);
    this.alpha = this._computeAlpha();
  }

  private _computeAlpha() {
    // 修正系数 α 的预计算值
    switch (this.m) {
      case 16:
        return 0.673;
      case 32:
        return 0.697;
      case 64:
        return 0.709;
      default:
        // p=14时,m=16384 alpha=0.72125
        // p=15时,m=32768 alpha=0.72128
        // p=20时,m=1048576 alpha=0.72130
        return 0.7213 / (1 + 1.079 / this.m);
    }
  }

  private _hash(value: string) {
    // 32位哈希函数
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash &= 0xffffffff; // 转换为32位整数
    }
    return hash;
  }

  // private _hash(value: string): number {
  //   let hash = 0x811c9dc5;

  //   for (let i = 0; i < value.length; i++) {
  //     hash ^= value.charCodeAt(i);
  //     hash +=
  //       (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  //     hash &= 0xffffffff;
  //   }

  //   hash = hash ^ 61 ^ (hash >>> 16);
  //   hash = hash + (hash << 3);
  //   hash = hash ^ (hash >>> 4);
  //   hash = hash * 0x27d4eb2d;
  //   hash = hash ^ (hash >>> 15);

  //   return hash & 0xffffffff;
  // }

  // 统计前导零(统计后 32-p位中 从左往右第一次出现1时，前面出现0的位数)
  private _countLeadingZeros(bits: number): number {
    if (bits === 0) return 32 - this.p;

    const totalBits = 32 - this.p;

    // 从最高位开始，找到第一个1的位置
    let position = totalBits - 1;
    while (position >= 0 && (bits & (1 << position)) === 0) {
      position--;
    }

    // 前导零数量 = 总位数 - (第一个1的位置 + 1)
    // 因为位置是从0开始计数的
    return totalBits - (position + 1);
  }

  add(value: number | string) {
    let hash = value;
    if (typeof value === 'number')
    {
      hash = value;
    } else if (typeof value === 'string')
    {
      hash = this._hash(value);
    } else {
      throw new Error("Only support number or string param.");
    }

    // 前 p 位作为桶索引
    const index = hash >>> (32 - this.p);

    // 后 (32-p) 位统计前导零
    const bits = hash & ((1 << (32 - this.p)) - 1);
    // 这里 前导零的数量 还要加上 第一个出现1的位
    const leadingZeros = this._countLeadingZeros(bits) + 1;

    if (leadingZeros > this.registers[index]) {
      this.registers[index] = leadingZeros;
    }
  }

  count(): number {
    let sum = 0;
    let zeroCount = 0;

    for (let i = 0; i < this.m; i++) {
      if (this.registers[i] === 0) {
        zeroCount++;
      }
      // 1/2^k, k=this.registers[i]
      sum += Math.pow(2, -this.registers[i]);
    }

    // 基础估算
    let estimate = (this.alpha * this.m * this.m) / sum;

    // 更保守的修正策略
    if (estimate <= 2.5 * this.m) {
      if (zeroCount > 0) {
        estimate = this.m * Math.log(this.m / zeroCount);
      }
    } else if (estimate > 1 << 31) {
      estimate = -(1 << 31) * Math.log(1 - estimate / (1 << 31));
    }

    return Math.round(estimate);
  }

  /**
   * 重置所有位为 0
   */
  reset(): void {
    this.registers.fill(0);
  }

  merge(other: HyperLogLog) {
    // 合并两个 HyperLogLog
    if (this.m !== other.m) {
      throw new Error("Precision mismatch");
    }

    for (let i = 0; i < this.m; i++) {
      if (other.registers[i] > this.registers[i]) {
        this.registers[i] = other.registers[i];
      }
    }
  }

  // 更新内存使用量计算
  getMemoryUsage() {
    return this.registers.byteLength; // 直接返回 Uint8Array 的字节长度
  }

  getRelativeError() {
    return 1.04 / Math.sqrt(this.m);
  }

  // 新增：获取寄存器状态的便捷方法
  getRegisters(): Uint8Array {
    return this.registers;
  }

  // 新增：从现有寄存器状态初始化（用于序列化/反序列化）
  setRegisters(registers: Uint8Array) {
    if (registers.length !== this.m) {
      throw new Error("Registers length mismatch");
    }
    this.registers.set(registers);
  }

  
  /**
   * 转换成 十六进制的字符串
   * @param compress 0: 不压缩，1: 压缩
   */
  toHexStr(compress: number = 1) {
    if (compress === 0) {
      return this._toHex();
    } else {
      return this._toCompressedHex();
    }
  }

  toJson()
  {
    return this.toHexStr();
  }

  /**
   * 从 十六进制的字符串 中加载数据
   * @param str 要加载的字符串
   * @param compress 0: 不压缩，1: 压缩
   */
  fromHexStr(str: string, compress: number = 1) {
    if (compress === 0) {
      this._fromHex(str);
    } else {
      this._fromCompressedHex(str);
    }
  }

  fromJson(str: string)
  {
    this.fromHexStr(str);
  }

  // 转换成二进制，For Test
  toBinary(): string {
    const chunks: string[] = [];
    for (let i = 0; i < this.registers.length; i++) {
      let binary = this.registers[i].toString(2).padStart(8, "0");
      chunks.push(binary);
    }
    return chunks.join(" ");
  }

  /**
   * 序列化为十六进制字符串
   */
  private _toHex(): string {
    const text: string[] = [];

    for (let i = 0; i < this.registers.length; i++) {
      // 将每个字节转换为两位十六进制，不足两位前面补零
      const hex = this.registers[i].toString(16).padStart(2, "0");
      text.push(hex);
    }

    return text.join("");
  }

  /**
   * 序列化为压缩的十六进制字符串（去除末尾的零）
   */
  private _toCompressedHex(): string {
    // 找到最后一个非零字节的索引
    let lastNonZeroIndex = -1;
    for (let i = this.registers.length - 1; i >= 0; i--) {
      if (this.registers[i] !== 0) {
        lastNonZeroIndex = i;
        break;
      }
    }

    // 如果所有字节都是零，返回空字符串
    if (lastNonZeroIndex === -1) {
      return "";
    }

    // 只序列化到最后一个非零字节
    const hexParts: string[] = [];
    for (let i = 0; i <= lastNonZeroIndex; i++) {
      const hex = this.registers[i].toString(16).padStart(2, "0");
      hexParts.push(hex);
    }

    return hexParts.join("");
  }

  /**
   * 从十六进制字符串反序列化
   */
  private _fromHex(hexString: string): void {
    // 验证十六进制字符串
    if (!/^[0-9a-fA-F]*$/.test(hexString)) {
      throw new Error("Invalid hexadecimal string");
    }

    // 每两个字符表示一个字节
    const expectedLength = Math.ceil(this.m / 8) * 2;

    if (hexString.length !== expectedLength) {
      throw new Error(
        `Hex string length mismatch. Expected ${expectedLength} characters, got ${hexString.length}`
      );
    }

    // 将十六进制字符串转换为字节数组
    for (let i = 0; i < this.registers.length; i++) {
      const hexByte = hexString.substr(i * 2, 2);
      this.registers[i] = parseInt(hexByte, 16);
    }
  }

  /**
   * 从压缩的十六进制字符串反序列化
   */
  private _fromCompressedHex(compressedHex: string): void {
    // 清空当前位图
    this.reset();

    if (!compressedHex) {
      return; // 空字符串表示所有位都是零
    }

    if (!/^[0-9a-fA-F]*$/.test(compressedHex)) {
      throw new Error("Invalid hexadecimal string");
    }

    if (compressedHex.length % 2 !== 0) {
      throw new Error("Hex string length must be even");
    }

    const byteCount = compressedHex.length / 2;
    if (byteCount > this.registers.length) {
      throw new Error("Compressed hex string too long for bitmap size");
    }

    // 填充字节数组
    for (let i = 0; i < byteCount; i++) {
      const hexByte = compressedHex.substr(i * 2, 2);
      this.registers[i] = parseInt(hexByte, 16);
    }

    // 剩余字节保持为零（因为已经 reset() 了）
  }

}

export default HyperLogLog;

// 测试Demo
// =========================================================

// HyperLogLog的用法
function testUsage() {
  console.log("------ 基础功能使用 ------");
  const hll = new HyperLogLog(15);
  hll.add("abc");
  hll.add("def");
  hll.add("ghijk");
  hll.add("123");
  console.log(`count1: ${hll.count()}`);
  hll.add("abc");
  console.log(`count2: ${hll.count()}`);
}

function testMerge() {
  console.log("------ merge功能演示 ------");
  const hll_01 = new HyperLogLog(14);
  const hll_02 = new HyperLogLog(14);
  for (let i = 0; i < 1000; i++) {
    hll_01.add(`element-${i}-${Math.random().toString(36).substring(2, 10)}`);
    hll_02.add(`element-${i}-${Math.random().toString(36).substring(2, 10)}`);
  }

  console.log(`hll_01 实际值: 1000, 估算值: ${hll_01.count()}`);
  console.log(`hll_02 实际值: 1000, 估算值: ${hll_02.count()}`);
  hll_01.merge(hll_02);
  console.log(`合并后 hll_01 估算值: ${hll_01.count()}`);
}

// 误差测试
function testAccuracy() {
  console.log("------ 误测测试 ------");
  const hll = new HyperLogLog(14);
  const actualCount = 10000; // 先用较小的数量测试

  console.log(`开始测试，添加 ${actualCount} 个元素...`);

  const startTime = Date.now();
  for (let i = 0; i < actualCount; i++) {
    // 确保生成唯一值
    hll.add(`element-${i}-${Math.random().toString(36).substring(2, 10)}`);
  }
  const endTime = Date.now();

  const estimatedCount = hll.count();
  const error = Math.abs(estimatedCount - actualCount) / actualCount;

  console.log(`实际值: ${actualCount}`);
  console.log(`估算值: ${estimatedCount}`);
  console.log(`相对误差: ${(error * 100).toFixed(2)}%`);
  console.log(`理论误差: ${(hll.getRelativeError() * 100).toFixed(2)}%`);
  console.log(`内存使用: ${hll.getMemoryUsage()} 字节`);
  console.log(`处理时间: ${endTime - startTime}ms`);
}

// 运行示例
if (require.main === module) {
  testUsage();
  testMerge();
  testAccuracy();
}

// =========================================================
