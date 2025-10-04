// models/bloomFilter.js
class BloomFilter {
  constructor(size = 16 * 1024, numHashes = 3) {
    this.size = size;
    this.numHashes = numHashes;
    this.bitArray = new Uint8Array(size).fill(false);
    this.count = 0;
  }

  // 改进的哈希函数 - 使用更好的哈希算法
  _hash(str, seed) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 31 + str.charCodeAt(i) + seed * 97) % this.size;
    }
    return Math.abs(hash);
  }

  // 添加元素
  add(item) {
    for (let i = 0; i < this.numHashes; i++) {
      const hash = this._hash(item, i + 1);
      this.bitArray[hash] = true;
    }
    this.count++;
  }

  // 检查元素是否存在
  mightContain(item) {
    for (let i = 0; i < this.numHashes; i++) {
      const hash = this._hash(item, i + 1);
      if (!this.bitArray[hash]) {
        return false;
      }
    }
    return true;
  }

  // 修正的元素数量估算方法
  estimateCount() {
    const m = this.size;
    const k = this.numHashes;
    const bitsSet = this.bitArray.filter(Boolean).length;
    const x = bitsSet / m;
    
    if (x === 0) return 0;
    if (x === 1) return Infinity; // 所有位都被设置，无法估算
    
    // 正确的 Bloom Filter 数量估算公式
    return Math.round(-(m / k) * Math.log(1 - x));
  }

  // 计算误判率
  falsePositiveRate() {
    const m = this.size;
    const k = this.numHashes;
    const bitsSet = this.bitArray.filter(Boolean).length;
    const x = bitsSet / m;
    
    return Math.pow(x, k);
  }

  // 静态方法：根据预期元素数量和目标误判率计算最优参数
  static optimalParams(expectedItems, falsePositiveRate) {
    const m = Math.ceil(-(expectedItems * Math.log(falsePositiveRate)) / (Math.log(2) ** 2));
    const k = Math.ceil((m / expectedItems) * Math.log(2));
    return { size: m, numHashes: k };
  }
}

module.exports = BloomFilter;

function testUsage() {
  const hll = new BloomFilter();

  hll.add("abc");
  hll.add("def");
  hll.add("ghijk");
  console.log(`count1: ${hll.estimateCount()}`);
  hll.add("abc");
  console.log(`count2: ${hll.estimateCount()}`);
}

// 改进的测试函数
function testAccuracy() {
  const expectedItems = 20000;
  const targetFalsePositiveRate = 0.01; // 1% 误判率
  
  // 使用最优参数
  const { size, numHashes } = BloomFilter.optimalParams(expectedItems, targetFalsePositiveRate);
  console.log(`优化参数: size=${size}, numHashes=${numHashes}`);
  
  const bf = new BloomFilter(size, numHashes);
  const actualCount = expectedItems;

  // 添加唯一元素
  for (let i = 0; i < actualCount; i++) {
    const randomNum = Math.floor(Math.random() * 1000000) + 1;
    bf.add(`user-${randomNum}-${Date.now()}-${i}-${Math.random()}`);
  }

  const estimatedCount = bf.estimateCount();
  const error = Math.abs(estimatedCount - actualCount) / actualCount;

  console.log(`实际值: ${actualCount}`);
  console.log(`估算值: ${estimatedCount}`);
  console.log(`相对误差: ${(error * 100).toFixed(2)}%`);
  console.log(`理论误判率: ${(bf.falsePositiveRate() * 100).toFixed(4)}%`);
}

// 测试误判率
function testFalsePositive() {
  const bf = new BloomFilter(100000, 7);
  const testSize = 10000;
  
  // 添加测试数据
  for (let i = 0; i < testSize; i++) {
    bf.add(`item-${i}`);
  }
  
  // 测试不存在的数据
  let falsePositives = 0;
  const testNonExisting = 10000;
  
  for (let i = testSize; i < testSize + testNonExisting; i++) {
    if (bf.mightContain(`non-existing-${i}`)) {
      falsePositives++;
    }
  }
  
  console.log(`实际误判率: ${(falsePositives / testNonExisting * 100).toFixed(2)}%`);
  console.log(`理论误判率: ${(bf.falsePositiveRate() * 100).toFixed(2)}%`);
}

testUsage();
testAccuracy();
testFalsePositive();