---
title: page_statistics接口文档
date: 2025-10-24 18:25:29
---

## POST 页面访问触发接口

POST /api/page-track

> Body 请求参数

```json
{
  "path": "/docs/website_building/select_server"
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 是 |none|
|» path|body|string| 是 |none|

> 返回示例

> 200 Response

```json
{
  "success": true,
  "message": "Page view tracked successfully"
}
```

> 404 Response

```json
{
  "error": "Not Found"
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|none|Inline|

### 返回数据结构

状态码 **200**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» success|boolean|true|none||none|
|» message|string|true|none||none|

状态码 **404**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» error|string|true|none||none|

## GET 页面访问查询接口

GET /api/page-stats

> Body 请求参数

```json
{}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|path|query|string| 是 |none|
|body|body|object| 是 |none|

> 返回示例

> 200 Response

```json
{
  "domain": "localhost",
  "path": "/docs/website_building/select_server",
  "lastUpdated": "2025-10-24",
  "stats": {
    "pv": 11,
    "uv": 1
  }
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

状态码 **200**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» domain|string|true|none||none|
|» path|string|true|none||none|
|» stats|object|true|none||none|
|»» pv|integer|true|none||none|
|»» uv|integer|true|none||none|

## GET 获取所有页面统计

GET /api/all-pages

> Body 请求参数

```json
{}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|sortBy|query|string| 否 |none|
|body|body|object| 是 |none|

> 返回示例

> 200 Response

```json
{
  "domain": "localhost",
  "count": 2,
  "sortBy": "pv",
  "pages": [
    {
      "path": "/docs/website_building/select_server",
      "pv": 11,
      "uv": 1,
      "lastUpdated": "2025-10-24"
    },
    {
      "path": "/docs/cuda/cuda_introduction",
      "pv": 3,
      "uv": 1,
      "lastUpdated": "2025-10-24"
    }
  ]
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

状态码 **200**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» domain|string|true|none||none|
|» count|integer|true|none||none|
|» sortBy|string|true|none||none|
|» pages|[object]|true|none||none|
|»» path|string|true|none||none|
|»» pv|integer|true|none||none|
|»» uv|integer|true|none||none|
|»» lastUpdated|string|true|none||日期时间|

## GET 获取每日统计

GET /api/daily-stats

> Body 请求参数

```json
{}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|date|query|string| 否 |none|
|body|body|object| 是 |none|

> 返回示例

> 200 Response

```json
{
  "domain": "localhost",
  "date": "2025-10-24",
  "stats": {
    "pv": 22,
    "uv": 1
  }
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

状态码 **200**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» domain|string|true|none||none|
|» date|string|true|none||none|
|» stats|object|true|none||none|
|»» pv|integer|true|none||none|
|»» uv|integer|true|none||none|

## GET 获取所有按天统计的数据

GET /api/all-dailies

> Body 请求参数

```json
{}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|sortBy|query|string| 否 |none|
|body|body|object| 是 |none|

> 返回示例

> 200 Response

```json
{
  "domain": "localhost",
  "count": 1,
  "dailies": [
    {
      "date": "2025-10-24",
      "pv": 22,
      "uv": 1
    }
  ]
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

状态码 **200**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» domain|string|true|none||none|
|» count|integer|true|none||none|
|» dailies|[object]|true|none||none|
|»» date|string|true|none||none|
|»» pv|integer|true|none||none|
|»» uv|integer|true|none||none|

## GET 网站访问量查询接口

GET /api/site-stats

> Body 请求参数

```json
{}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 是 |none|

> 返回示例

> 200 Response

```json
{
  "domain": "localhost",
  "total": {
    "pv": 22,
    "uv": 1
  },
  "today": {
    "pv": 22,
    "uv": 1
  },
  "totalPages": 8
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

状态码 **200**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» domain|string|true|none||none|
|» total|object|true|none||none|
|»» pv|integer|true|none||none|
|»» uv|integer|true|none||none|
|» today|object|true|none||none|
|»» pv|integer|true|none||none|
|»» uv|integer|true|none||none|
|» totalPages|integer|true|none||none|
