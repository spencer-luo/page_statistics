import HyperLogLog from "./hyperloglog";
import SetCounter from "./setcounter";
import logger from "logger";

enum CountType {
  set, // 0, Set容器
  llm, // 1, HyperLogLog
}

const SET_START = 0; // [SET_START, LLM_START)用Set表示
const LLM_START = 512; // 2^10, [LLM_START, 无穷大)用HyperLogLog表示

class UvCounter {
  private type: CountType;
  private counter: SetCounter | HyperLogLog;
  //   private type:

  //   , data: Array(number) = []
  constructor(type = CountType.set) {
    // 初始化为set方式
    this.type = type;
    if (this.type == CountType.set) {
        this.counter = new SetCounter();
    } else {
        this.counter = new HyperLogLog();
    }
  }

  getType() {
    return this.type;
  }

  add(clientId: string) {
    let value = this._hash(clientId);
    this.counter.add(value);

    // 添加完元素后，检查并更新容器类型。
    this._updateType();
  }

  count(): number {
    return this.counter.count();
  }

  // 自定义序列化行为
  toJSON(): string | Record<string, any> {
    return {
      type: this.type,
      data: this.counter.toJson(),
    };
  }

  // 静态工厂方法用于反序列化
  static fromJSON(json: string | Record<string, any>): UvCounter {
    const data = typeof json === "string" ? JSON.parse(json) : json;

    const uv = new UvCounter(data.type);
    uv.counter.fromJson(data.data);

    return uv;
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

  private _updateType() {
    const count = this.count();
    if (count >= LLM_START && this.type != CountType.llm) {
      // Bitmpa最多只能统计LLM_START个数值，LLM_START - 2是为了增加两次类型转换的机会。
      // 如果恰好在这个临界值进程重启了，可能会错过类型转换的机会。
      this._set2llm();
      logger.info(`SetCounter converted to HyperLogLog, size: ${count} --> ${this.count()}`);
    }
  }

  _set2llm() {
    const hll = new HyperLogLog();
    (this.counter as SetCounter).valueList().forEach((val) => {
      hll.add(val);
    });

    this.type = CountType.llm;
    this.counter = hll;
  }
}

export default UvCounter;

// 测试Demo
// =========================================================

import crypto from 'crypto';

function testSetCounter() {
  const counter = new UvCounter();
  counter.add("abc");
  counter.add("defg");
  console.log("count 1:", counter.count());
  counter.add("Hello World!");
  console.log("count 2:", counter.count());
  const text = JSON.stringify(counter);
  console.log("json str content:\n", text);
  const counter2 = UvCounter.fromJSON(text);
  console.log("counter 2 count:", counter2.count());
}

function testBitmap() {
  const uv = new UvCounter();

  // 初始化元素
  for (let i = 0; i < LLM_START - 2; i++) {
    let clientId = `element-${i}-${Math.random().toString(36).substring(2, 10)}`;
    // clientId = crypto.createHash('sha256').update(clientId).digest('hex');
    uv.add(clientId);
  }

  console.log(`uv init type: ${uv.getType()} count: ${uv.count()}`);
  uv.add("abcd");
  uv.add("efgh");
  console.log(`added element type: ${uv.getType()} count: ${uv.count()}`);

  const text = JSON.stringify(uv);
  console.log("text:\n", text)

  const uv2 = UvCounter.fromJSON(text);
  console.log(`uv 2 type: ${uv2.getType()} count: ${uv2.count()}`);
  uv2.add("Hello World");
  console.log(`uv 2 type: ${uv2.getType()} count: ${uv2.count()}`);
}

// 运行示例
if (require.main === module) {
//   testSetCounter();
  testBitmap();
}
// =========================================================
