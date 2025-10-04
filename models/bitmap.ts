class Bitmap {
  private bits: Uint8Array;
  private readonly size: number;

  constructor(size: number) {
    this.size = size;
    this.bits = new Uint8Array(Math.ceil(size / 8));
  }

  /**
   * 设置指定位置为 1
   */
  set(position: number): void {
    if (position < 0 || position >= this.size) {
      throw new Error(`Position ${position} out of range [0, ${this.size})`);
    }

    // 因为 bits 的索引从0开始
    const index = position >>> 3; // position / 8
    const offset = position % 8;
    this.bits[index] |= 1 << offset;
  }

  /**
   * 清除指定位置（设置为 0）
   */
  clear(position: number): void {
    if (position < 0 || position >= this.size) {
      throw new Error(`Position ${position} out of range [0, ${this.size})`);
    }

    const index = position >>> 3; // position / 8
    const offset = position % 8;
    this.bits[index] &= ~(1 << offset);
  }

  /**
   * 检查指定位置是否为 1
   */
  get(position: number): boolean {
    if (position < 0 || position >= this.size) {
      throw new Error(`Position ${position} out of range [0, ${this.size})`);
    }

    const index = position >>> 3; // position / 8
    const offset = position % 8;
    return (this.bits[index] & (1 << offset)) !== 0;
  }

  /**
   * 获取所有设置为 1 的位置
   */
  getPositions(): number[] {
    const positions: number[] = [];
    for (let i = 0; i < this.bits.length; i++) {
      const byte = this.bits[i];
      if (byte === 0) continue;

      const base = i * 8;
      for (let j = 0; j < 8; j++) {
        if ((byte & (1 << j)) !== 0) {
          positions.push(base + j);
        }
      }
    }
    return positions;
  }

  /**
   * 获取所有设置为 1 的位置数量
   */
  count(): number {
    let count = 0;
    for (let i = 0; i < this.bits.length; i++) {
      let byte = this.bits[i] & 0xff;
      for (let j = 0; j < 8; j++) {
        // 方法一
        if ((byte & (1 << j)) !== 0) {
          count++;
        }
        // 方法二
        // if (((byte >>> j) & 0x01) == 1)
        // {
        //     count ++;
        // }
      }
    }
    return count;
  }

  /**
   * 重置所有位为 0
   */
  reset(): void {
    this.bits.fill(0);
  }

  /**
   * 与另一个位图进行 AND 操作
   */
  and(other: Bitmap): Bitmap {
    if (this.size !== other.size) {
      throw new Error("Bitmaps must have the same size");
    }

    const result = new Bitmap(this.size);
    for (let i = 0; i < this.bits.length; i++) {
      result.bits[i] = this.bits[i] & other.bits[i];
    }
    return result;
  }

  /**
   * 与另一个位图进行 OR 操作
   */
  or(other: Bitmap): Bitmap {
    if (this.size !== other.size) {
      throw new Error("Bitmaps must have the same size");
    }

    const result = new Bitmap(this.size);
    for (let i = 0; i < this.bits.length; i++) {
      result.bits[i] = this.bits[i] | other.bits[i];
    }
    return result;
  }

  /**
   * 对位图进行 NOT 操作
   */
  not(): Bitmap {
    const result = new Bitmap(this.size);
    for (let i = 0; i < this.bits.length; i++) {
      result.bits[i] = ~this.bits[i];
    }
    return result;
  }

  /**
   * 序列化为十六进制字符串
   */
  private toHex(): string {
    const text: string[] = [];

    for (let i = 0; i < this.bits.length; i++) {
      // 将每个字节转换为两位十六进制，不足两位前面补零
      const hex = this.bits[i].toString(16).padStart(2, "0");
      text.push(hex);
    }

    return text.join("");
  }

  /**
   * 序列化为压缩的十六进制字符串（去除末尾的零）
   */
  private toCompressedHex(): string {
    // 找到最后一个非零字节的索引
    let lastNonZeroIndex = -1;
    for (let i = this.bits.length - 1; i >= 0; i--) {
      if (this.bits[i] !== 0) {
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
      const hex = this.bits[i].toString(16).padStart(2, "0");
      hexParts.push(hex);
    }

    return hexParts.join("");
  }

  /**
   * 从十六进制字符串反序列化
   */
  private fromHex(hexString: string): void {
    // 验证十六进制字符串
    if (!/^[0-9a-fA-F]*$/.test(hexString)) {
      throw new Error("Invalid hexadecimal string");
    }

    // 每两个字符表示一个字节
    const expectedLength = Math.ceil(this.size / 8) * 2;

    if (hexString.length !== expectedLength) {
      throw new Error(
        `Hex string length mismatch. Expected ${expectedLength} characters, got ${hexString.length}`
      );
    }

    // 将十六进制字符串转换为字节数组
    for (let i = 0; i < this.bits.length; i++) {
      const hexByte = hexString.substr(i * 2, 2);
      this.bits[i] = parseInt(hexByte, 16);
    }
  }

  /**
   * 从压缩的十六进制字符串反序列化
   */
  private fromCompressedHex(compressedHex: string): void {
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
    if (byteCount > this.bits.length) {
      throw new Error("Compressed hex string too long for bitmap size");
    }

    // 填充字节数组
    for (let i = 0; i < byteCount; i++) {
      const hexByte = compressedHex.substr(i * 2, 2);
      this.bits[i] = parseInt(hexByte, 16);
    }

    // 剩余字节保持为零（因为已经 reset() 了）
  }

  /**
   * 转换成 十六进制的字符串
   * @param compress 0: 不压缩，1: 压缩
   */
  toHexStr(compress: number = 1) {
    if (compress === 0) {
      return this.toHex();
    } else {
      return this.toCompressedHex();
    }
  }

  /**
   * 从 十六进制的字符串 中加载数据
   * @param str 要加载的字符串
   * @param compress 0: 不压缩，1: 压缩
   */
  fromHexStr(str: string, compress: number = 1) {
    if (compress === 0) {
      this.fromHex(str);
    } else {
      this.fromCompressedHex(str);
    }
  }

  // 转换成二进制，For Test
  toBinary(): string {
    const chunks: string[] = [];
    for (let i = 0; i < this.bits.length; i++) {
      let binary = this.bits[i].toString(2).padStart(8, "0");
      chunks.push(binary);
    }
    return chunks.join(" ");
  }
}

// 测试Demo
// =========================================================

// 基础 Bitmap 使用示例
function basicBitmapExample(): void {
  console.log("------ 基础 Bitmap 示例 ------");

  const bitmap = new Bitmap(100);

  // 设置一些位
  bitmap.set(5);
  bitmap.set(10);
  bitmap.set(15);
  bitmap.set(20);

  // 检查位状态
  console.log("位置 5:", bitmap.get(5)); // true
  console.log("位置 7:", bitmap.get(7)); // false

  // 获取所有设置的位
  console.log("所有设置的位:", bitmap.getPositions()); // [5, 10, 15, 20]

  // 统计数量
  console.log("设置位数量:", bitmap.count()); // 4

  // 清除一个位
  bitmap.clear(10);
  // [5, 15, 20]
  console.log(
    `清除位置 10 后: ${bitmap.getPositions()} count: ${bitmap.count()}`
  );
}

// 位图运算示例
function bitmapOperationsExample(): void {
  console.log("------ 位图运算示例 ------");

  const bitmap1 = new Bitmap(32);
  const bitmap2 = new Bitmap(32);

  bitmap1.set(1);
  bitmap1.set(3);
  bitmap1.set(5);

  bitmap2.set(3);
  bitmap2.set(5);
  bitmap2.set(7);

  //   打印bitmap1和bitmap2
  console.log("bitmap1:", bitmap1.getPositions());
  console.log("bitmap2:", bitmap2.getPositions());

  // AND 操作（交集）
  const andResult = bitmap1.and(bitmap2);
  console.log("AND 结果:", andResult.getPositions()); // [3, 5]

  // OR 操作（并集）
  const orResult = bitmap1.or(bitmap2);
  console.log("OR 结果:", orResult.getPositions()); // [1, 3, 5, 7]

  // NOT 操作
  const notResult = bitmap1.not();
  console.log("bitmap1 NOT 结果前5位:", notResult.getPositions().slice(0, 5));
}

function hexSerializationDemo(): void {
  console.log("------ 十六进制序列化演示 ------");

  // 创建位图并设置一些位
  const bitmap = new Bitmap(32);
  bitmap.set(0);
  bitmap.set(1);
  bitmap.set(3);
  bitmap.set(7);
  bitmap.set(15);
  bitmap.set(21);

  console.log("设置的位:", bitmap.getPositions());
  console.log("二进制表示:", bitmap.toBinary());

  // 序列化为十六进制
  const hexString = bitmap.toHexStr(0);
  console.log("十六进制序列化:", hexString);
  console.log("十六进制长度:", hexString.length);

  // 序列化为压缩十六进制
  const compressedHex = bitmap.toHexStr();
  console.log("压缩十六进制:", compressedHex);
  console.log("压缩后长度:", compressedHex.length);

  // 反序列化测试1
  const bitmap2 = new Bitmap(32);
  bitmap2.fromHexStr(hexString, 0);
  console.log("反序列化后位1:", bitmap2.getPositions());
  console.log(
    "反序列化验证1:",
    bitmap.getPositions().join(",") === bitmap2.getPositions().join(",")
  );

  // 反序列化测试2
  const bitmap3 = new Bitmap(32);
  bitmap3.fromHexStr(compressedHex);
  console.log("反序列化后位2:", bitmap3.getPositions());
  console.log(
    "反序列化验证2:",
    bitmap.getPositions().join(",") === bitmap3.getPositions().join(",")
  );
}

// 运行示例
if (require.main === module) {
  basicBitmapExample();
  bitmapOperationsExample();
  hexSerializationDemo();
}
// =========================================================
