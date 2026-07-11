# PowerJulia (JGDO)

可视化配电网设计与分析仿真网站：浏览器里拖拽搭建配电网拓扑，Julia 内核实时计算 **AC 潮流** 与 **网络重构 + 分布式电源联合优化**（目标：网损最小），结果直接着色回画布。

- **计算内核**：Julia + PowerModels（AC 潮流，Ipopt）+ JuMP MINLP（DistFlow 二阶锥松弛 + 生成树辐射约束，Juniper/HiGHS/Ipopt）
- **服务层**：Oxygen.jl 常驻 HTTP 服务（暖请求潮流 ~10ms、33 节点 ~50ms）
- **前端**：Vite + TypeScript + JointJS 画布（`web/`）
- **数值金标准**：IEEE 33 节点（Baran & Wu）基线网损 202.68 kW / 文献最优重构 139.55 kW，已纳入测试断言

## 快速开始

```bash
# 1. 安装 Julia 依赖（首次）
julia --project=. -e "using Pkg; Pkg.instantiate()"

# 2. 构建前端（首次或前端改动后）
cd web && npm install && npm run build && cd ..

# 3. 启动服务
julia --project=. scripts/serve.jl
```

打开 <http://127.0.0.1:8123>。启动到就绪约 20 秒（Julia 包加载），首次计算含 JIT 约 15–30 秒，之后毫秒级。

> 本机若设置了 `http_proxy`，用 curl 调试需加 `--noproxy "*"`。

### 前端开发模式

```bash
cd web && npm run dev   # Vite 开发服务器，/api 自动代理到 127.0.0.1:8123
```

## 使用方式

1. **示例算例**：顶栏下拉加载内置算例（含 IEEE 33 节点基准、重构测试网等）。
2. **手工建模**：左侧元件库点击添加母线/负荷/电源/DG；从元件**连接桩**（小圆点）拖到另一母线成线路，设备拖到母线即挂接；元件本体拖动移动；点击元件在右侧检查器编辑参数（线路/开关类型也在检查器切换）。
3. **⚡ 潮流计算**：母线按电压着色并标注 vm/va，支路按负载率着色、箭头指示潮流方向。
4. **🎯 重构优化**：给出开关开合方案与降损百分比，可一键"应用开关方案到画布"后复算潮流验证。
5. 拓扑支持 JSON 导入/导出；画布草稿自动存入浏览器 localStorage。

## HTTP API

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/pf` | 拓扑 JSON → AC 潮流结果 |
| POST | `/api/reconfig` | 拓扑 JSON → 重构 + DG 优化结果 |
| GET | `/api/examples` | 列出内置算例 |
| GET | `/api/examples/{name}` | 获取算例拓扑 JSON |
| GET | `/health` | 存活检查 |

统一响应封套：`{status: "ok"|"error", code?, message, path?, data}`。成功的计算自动落盘 `runs/YYYYMMDD-HHMMSS.json` 快照。

## 拓扑 JSON 契约（扁平字段）

```jsonc
{
  "meta": { "baseMVA": 100.0, "feeder": "F1" },
  "nodes": [
    { "id": "bus-1", "type": "Bus", "kv": 10.5, "is_slack": true, "vm_pu": 1.0,
      "vmin_pu": 0.95, "vmax_pu": 1.05 },
    { "id": "load-1", "type": "Load", "bus": "bus-2", "p_kw": 800, "q_kvar": 200 },
    { "id": "dg-1", "type": "DG", "bus": "bus-3", "p_kw": 200, "p_max_kw": 400,
      "q_max_kvar": 150, "q_min_kvar": -150, "status": 1 }
  ],
  "links": [
    { "id": "line-1", "type": "Line", "from": "bus-1", "to": "bus-2",
      "r_ohm": 0.1, "x_ohm": 0.3, "rate_mva": 10 },
    { "id": "sw-1", "type": "Switch", "from": "bus-2", "to": "bus-3",
      "r_ohm": 0.001, "x_ohm": 0.003, "status": "OPEN", "switchable": true }
  ]
}
```

要点：电气参数一律放在节点/连线的**顶层**（不要嵌套 `data` 子对象）；设备用 `bus` 字段挂接母线；`switchable` 控制支路是否参与重构（缺省 Switch 为 true、Line 为 false）。单位：kW/kvar/Ω/MVA/kV/度，内核会统一换算为标幺值。

## 目录结构

```
src/                  Julia 计算内核（JGDO 包）
  JGDO.jl             主模块：run_pf / run_reconfiguration_dg / write_run_snapshot
  types.jl            拓扑数据模型（Node/Link/TopologyData）
  topology.jl         拓扑 JSON → PowerModels 数据（单位换算、连通性校验、per-unit 化）
  powerflow.jl        AC 潮流 + 支路潮流回算（calc_branch_flow_ac）+ 越限判定
  optimization.jl     重构 MINLP（DistFlow SOC + 辐射约束 + 辐射可行性预检）
  errors.jl           领域异常 + 统一响应封套
scripts/serve.jl      Oxygen HTTP 服务（API + 静态托管 web/dist）
web/                  前端（Vite + TS + JointJS）
examples/             内置算例（ieee33.json 为数值金标准）
test/runtests.jl      测试套件（含 IEEE 33 节点黄金断言）
runs/                 计算快照
```

## 测试

```bash
julia --project=. -e "using Pkg; Pkg.test()"
```

关键断言：33 节点基线网损 202.68±0.5 kW、最低电压 0.9131 pu @ bus-18、文献最优重构 139.55±0.5 kW；重构端到端降损为正；非开关支路成环时快速失败。

## 已知边界

- 平衡单相等值模型（不含三相不平衡）；短路/谐波计算不在当前范围。
- 重构 MINLP 由 Juniper（局部求解器）求解，`time_limit` 300 秒，大网络不保证全局最优。
- 单用户本机/内网使用设计；公网部署需自行加认证与资源限流。

## 路线图

结果导出报告、N-1 校验、时序潮流、变压器支路建模（tap/shift 已预留字段）、更多标准算例（IEEE 69 等）。
