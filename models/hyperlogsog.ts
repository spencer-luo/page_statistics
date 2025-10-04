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

  add(value: string) {
    const hash = this._hash(value);

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
}

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
