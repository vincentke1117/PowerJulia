(function () {
  // ==================== Electron 集成 ====================
  // 检测 Electron 环境
  const isElectron = window.electronAPI !== undefined;
  const electronAPI = window.electronAPI || {};

  // 菜单事件监听器
  if (isElectron) {
    const cleanup = electronAPI.onMenuAction((event, data) => {
      switch (event) {
        case 'menu-new':
          if (confirm('确定要清空当前画布吗？此操作不可撤销。')) {
            graph.clear();
          }
          break;
        case 'menu-import':
          try {
            const json = JSON.parse(data);
            importTopology(json);
          } catch (err) {
            alert(`无法解析文件: ${err.message}`);
          }
          break;
        case 'menu-export':
          saveTopology();
          break;
        case 'menu-run-pf':
          runPf();
          break;
        case 'menu-run-optimization':
          runOptimization();
          break;
        case 'menu-toggle-legend':
          legendManager.toggle();
          break;
        case 'menu-zoom-in':
          zoomIn();
          break;
        case 'menu-zoom-out':
          zoomOut();
          break;
        case 'menu-zoom-reset':
          resetZoom();
          break;
        case 'menu-help':
          helpSystem.show();
          break;
      }
    });
  }

  // ==================== 工具函数 ====================

  function generateId() {
    return Math.random().toString(36).substr(2, 9);
  }

  // ==================== 常量定义 ====================

  const SWITCH_STATUS_OPTIONS = [
    { value: 'CLOSED', label: '合闸 (CLOSED)' },
    { value: 'OPEN', label: '分闸 (OPEN)' }
  ];

  const GENERATOR_STATUS_OPTIONS = [
    { value: 1, label: '投入 (1)' },
    { value: 0, label: '停运 (0)' }
  ];

  // ==================== 节点类型映射 ====================

  const NODE_DEFINITIONS = {
    Bus: {
      label: 'Bus',
      name: '母线',
      color: {
        normal: '#1976d2',
        hover: '#2196f3',
        selected: '#0d47a1',
        disabled: '#90a4ae'
      },
      size: { width: 80, height: 40 },
      shape: 'rect',
      icon: '⚡',
      borderRadius: 4,
      description: '电力系统中的母线或节点，用于连接其他设备'
    },
    Load: {
      label: 'Load',
      name: '负荷',
      color: {
        normal: '#f57f17',
        hover: '#ff9800',
        selected: '#e65100',
        disabled: '#bcaaa4'
      },
      size: { width: 50, height: 50 },
      shape: 'circle',
      icon: '📊',
      borderRadius: 25,
      description: '电力负荷，消耗电能的设备或区域'
    },
    Gen: {
      label: 'Gen',
      name: '发电机',
      color: {
        normal: '#0d47a1',
        hover: '#1565c0',
        selected: '#003c8f',
        disabled: '#546e7a'
      },
      size: { width: 60, height: 60 },
      shape: 'diamond',
      icon: '⚙️',
      borderRadius: 8,
      description: '发电机组，产生电能的设备'
    },
    DG: {
      label: 'DG',
      name: '分布式电源',
      color: {
        normal: '#2e7d32',
        hover: '#388e3c',
        selected: '#1b5e20',
        disabled: '#66bb6a'
      },
      size: { width: 60, height: 60 },
      shape: 'diamond',
      icon: '☀️',
      borderRadius: 8,
      description: '分布式电源，如太阳能、风能等小型发电设备'
    },
    Transformer: {
      label: 'XFMR',
      name: '变压器',
      color: {
        normal: '#5e35b1',
        hover: '#7e57c2',
        selected: '#4527a0',
        disabled: '#9575cd'
      },
      size: { width: 80, height: 60 },
      shape: 'rounded-rect',
      icon: '🔌',
      borderRadius: 12,
      description: '变压器，用于改变电压等级'
    },
    Switch: {
      label: 'Switch',
      name: '开关',
      color: {
        normal: '#009688',
        hover: '#26a69a',
        selected: '#00695c',
        disabled: '#80cbc4',
        open: '#ef5350',
        closed: '#66bb6a'
      },
      size: { width: 40, height: 40 },
      shape: 'circle',
      icon: '🔘',
      borderRadius: 20,
      description: '开关设备，用于控制电路的通断'
    }
  };

  // ==================== 图例组件 ====================

  class LegendManager {
    constructor(container) {
      this.container = container;
      this.isVisible = false;
      this.createLegend();
    }

    createLegend() {
      this.container.innerHTML = `
        <div class="legend-overlay" id="legend-overlay">
          <div class="legend-card">
            <div class="legend-header">
              <h3 class="legend-title">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <circle cx="10" cy="10" r="8" opacity="0.3"/>
                  <circle cx="10" cy="10" r="6" opacity="0.5"/>
                  <circle cx="10" cy="10" r="4" opacity="0.7"/>
                </svg>
                节点类型说明
              </h3>
              <button class="legend-close" aria-label="关闭图例">&times;</button>
            </div>
            <div class="legend-content">
              ${this.createLegendContent()}
            </div>
            <div class="legend-footer">
              <p class="legend-tip">💡 悬停在节点上查看更多信息</p>
            </div>
          </div>
        </div>
      `;
      this.bindEvents();
    }

    createLegendContent() {
      return Object.entries(NODE_DEFINITIONS).map(([type, def]) => {
        const shapeSvg = this.getShapeSvg(def.shape, def.size, def.color.normal);
        return `
          <div class="legend-item" data-type="${type}">
            <div class="legend-visual">
              ${shapeSvg}
            </div>
            <div class="legend-info">
              <div class="legend-type">
                <span class="legend-type-label">${def.label}</span>
                <span class="legend-type-name">${def.name}</span>
              </div>
              <div class="legend-description">${def.description}</div>
            </div>
            <div class="legend-actions">
              <button class="legend-highlight" data-type="${type}" title="高亮此类型">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <circle cx="8" cy="8" r="6"/>
                </svg>
              </button>
            </div>
          </div>
        `;
      }).join('');
    }

    getShapeSvg(shape, size, color) {
      const { width, height } = size;
      const centerX = width / 2;
      const centerY = height / 2;

      if (shape === 'circle') {
        return `
          <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
            <circle cx="${centerX}" cy="${centerY}" r="${Math.min(width, height) / 2 - 2}"
              fill="${color}" stroke="#fff" stroke-width="2"/>
            <text x="${centerX}" y="${centerY + 4}" text-anchor="middle"
              fill="white" font-size="10">⚡</text>
          </svg>
        `;
      } else if (shape === 'diamond') {
        return `
          <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
            <path d="M ${centerX} 2 L ${width-2} ${centerY} L ${centerX} ${height-2} L 2 ${centerY} Z"
              fill="${color}" stroke="#fff" stroke-width="2"/>
            <text x="${centerX}" y="${centerY + 3}" text-anchor="middle"
              fill="white" font-size="10">⚙️</text>
          </svg>
        `;
      } else if (shape === 'rounded-rect') {
        return `
          <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
            <rect x="2" y="2" width="${width-4}" height="${height-4}"
              rx="8" fill="${color}" stroke="#fff" stroke-width="2"/>
            <text x="${centerX}" y="${centerY + 3}" text-anchor="middle"
              fill="white" font-size="10">🔌</text>
          </svg>
        `;
      } else {
        return `
          <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
            <rect x="2" y="2" width="${width-4}" height="${height-4}"
              rx="4" fill="${color}" stroke="#fff" stroke-width="2"/>
            <text x="${centerX}" y="${centerY + 3}" text-anchor="middle"
              fill="white" font-size="10">⚡</text>
          </svg>
        `;
      }
    }

    bindEvents() {
      const overlay = document.getElementById('legend-overlay');
      const closeBtn = this.container.querySelector('.legend-close');

      closeBtn.addEventListener('click', () => this.hide());

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          this.hide();
        }
      });

      // 高亮按钮事件
      this.container.querySelectorAll('.legend-highlight').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const type = btn.dataset.type;
          this.highlightType(type);
        });
      });
    }

    show() {
      this.container.classList.add('active');
      this.isVisible = true;
    }

    hide() {
      this.container.classList.remove('active');
      this.isVisible = false;
    }

    toggle() {
      if (this.isVisible) {
        this.hide();
      } else {
        this.show();
      }
    }

    highlightType(type) {
      // 触发高亮事件
      document.dispatchEvent(new CustomEvent('legend-highlight', {
        detail: { type }
      }));
    }
  }

  // 创建图例管理器
  const legendManager = new LegendManager(document.getElementById('legend-container'));

  // ==================== 参数编辑器类 ====================

  class ParameterEditor {
    constructor() {
      this.currentElement = null;
      this.currentType = null;
      this.isOpen = false;

      this.dialog = document.getElementById('parameter-dialog');
      this.form = document.getElementById('parameter-form');
      this.btnSave = document.getElementById('btn-save');
      this.btnCancel = document.getElementById('btn-cancel');
      this.btnClose = document.getElementById('dialog-close');

      this.paramName = document.getElementById('param-name');
      this.paramValue = document.getElementById('param-value');
      this.paramHelp = document.getElementById('param-help');
      this.paramMin = document.getElementById('param-min');
      this.paramMax = document.getElementById('param-max');
      this.paramUnit = document.getElementById('param-unit');
      this.paramDescription = document.getElementById('param-description');
      this.paramError = document.getElementById('param-error');

      this.initializeEvents();
    }

    initializeEvents() {
      // 关闭按钮
      this.btnClose.addEventListener('click', () => this.close());
      this.btnCancel.addEventListener('click', () => this.close());

      // ESC 键关闭
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen) {
          this.close();
        }
      });

      // 点击背景关闭
      this.dialog.addEventListener('click', (e) => {
        if (e.target === this.dialog) {
          this.close();
        }
      });

      // 保存按钮
      this.btnSave.addEventListener('click', () => this.save());

      // 实时验证
      this.paramValue.addEventListener('input', () => this.validate());
      this.paramValue.addEventListener('blur', () => this.validate());
    }

    open(element, type) {
      this.currentElement = element;
      this.currentType = type;

      // 获取元素数据
      const data = element.get('data') || {};
      const elementName = element.get('name') || type;

      // 配置参数字段
      this.setupParameterFields(type, elementName, data);

      // 显示对话框
      this.dialog.classList.add('active');
      this.dialog.setAttribute('aria-hidden', 'false');
      this.isOpen = true;

      // 聚焦到输入框
      setTimeout(() => {
        this.paramValue.focus();
        this.paramValue.select();
      }, 100);
    }

    setupParameterFields(type, elementName, data) {
      // 根据元件类型设置参数
      const configs = this.getParameterConfigs(type);

      // 设置基本信息
      this.paramName.value = configs.label || type;
      this.paramHelp.textContent = configs.description || '';
      this.paramDescription.value = configs.longDescription || '';

      // 设置验证规则
      this.paramValue.min = configs.min !== undefined ? configs.min : '';
      this.paramValue.max = configs.max !== undefined ? configs.max : '';
      this.paramValue.step = configs.step || '0.01';

      // 显示范围和单位提示
      this.paramMin.textContent = configs.min !== undefined ? `最小值: ${configs.min}` : '最小值: -';
      this.paramMax.textContent = configs.max !== undefined ? `最大值: ${configs.max}` : '最大值: -';
      this.paramUnit.textContent = configs.unit ? `单位: ${configs.unit}` : '单位: -';

      // 设置当前值
      const currentValue = data.value !== undefined ? data.value : configs.defaultValue || '';
      this.paramValue.value = currentValue;

      // 清除错误状态
      this.clearValidation();
    }

    getParameterConfigs(type) {
      // 根据元件类型返回参数配置
      const configs = {
        Bus: {
          label: '母线电压等级',
          description: '母线的额定电压等级',
          longDescription: '设置母线的额定电压等级，影响潮流计算的基准值。单位：kV',
          unit: 'kV',
          min: 0.1,
          max: 1000,
          step: 0.1,
          defaultValue: 10.5
        },
        Load: {
          label: '负荷有功功率',
          description: '负荷消耗的有功功率',
          longDescription: '设置负荷节点消耗的有功功率。单位：kW',
          unit: 'kW',
          min: 0,
          max: 10000,
          step: 0.1,
          defaultValue: 100
        },
        DG: {
          label: 'DG有功出力',
          description: '分布式电源的额定有功出力',
          longDescription: '设置分布式电源的额定有功出力。单位：kW',
          unit: 'kW',
          min: 0,
          max: 5000,
          step: 0.1,
          defaultValue: 100
        },
        Line: {
          label: '线路电阻',
          description: '线路的电阻参数',
          longDescription: '设置线路的电阻值，影响线路的损耗和电压降。单位：Ω',
          unit: 'Ω',
          min: 0.01,
          max: 100,
          step: 0.01,
          defaultValue: 0.1
        },
        Switch: {
          label: '开关状态',
          description: '开关的当前状态',
          longDescription: '控制开关的闭合/断开状态。',
          unit: '',
          min: 0,
          max: 1,
          step: 1,
          defaultValue: 1
        }
      };

      return configs[type] || {
        label: '参数值',
        description: '请输入参数值',
        longDescription: '',
        unit: '',
        min: undefined,
        max: undefined,
        step: '0.01',
        defaultValue: 0
      };
    }

    validate() {
      this.clearValidation();

      const value = this.paramValue.value;
      const min = this.paramValue.min ? parseFloat(this.paramValue.min) : null;
      const max = this.paramValue.max ? parseFloat(this.paramValue.max) : null;

      // 检查是否为空
      if (!value || value.trim() === '') {
        this.showError('请输入参数值');
        return false;
      }

      // 检查数值类型
      const numValue = parseFloat(value);
      if (isNaN(numValue)) {
        this.showError('请输入有效的数值');
        return false;
      }

      // 检查最小值
      if (min !== null && numValue < min) {
        this.showError(`值不能小于 ${min}`);
        return false;
      }

      // 检查最大值
      if (max !== null && numValue > max) {
        this.showError(`值不能大于 ${max}`);
        return false;
      }

      // 验证通过
      this.paramValue.classList.add('success');
      return true;
    }

    showError(message) {
      this.paramValue.classList.add('error');
      this.paramValue.classList.remove('success');
      this.paramError.textContent = message;
    }

    clearValidation() {
      this.paramValue.classList.remove('error', 'success');
      this.paramError.textContent = '';
    }

    save() {
      if (!this.validate()) {
        return;
      }

      const value = parseFloat(this.paramValue.value);

      // 更新元素数据
      if (this.currentElement) {
        const data = this.currentElement.get('data') || {};
        data.value = value;
        this.currentElement.set('data', data);

        // 如果是开关类型，处理状态
        if (this.currentType === 'Switch') {
          const status = value === 1 ? 'CLOSED' : 'OPEN';
          data.status = status;
          this.currentElement.set('data', data);

          // 更新视觉样式
          this.updateSwitchVisual(this.currentElement, status);
        }
      }

      this.close();
    }

    updateSwitchVisual(element, status) {
      // 更新开关的可视化表示
      // 这里可以根据状态改变颜色、样式等
      const color = status === 'CLOSED' ? '#4caf50' : '#f44336';
      element.attr('body/fill', color);
    }

    close() {
      this.dialog.classList.remove('active');
      this.dialog.setAttribute('aria-hidden', 'true');
      this.isOpen = false;
      this.clearValidation();

      // 清理状态
      this.currentElement = null;
      this.currentType = null;
    }
  }

  // 初始化参数编辑器
  const parameterEditor = new ParameterEditor();

  // ==================== 按钮状态管理器 ====================

  class ButtonStateManager {
    static setLoading(button, isLoading, text = null) {
      if (isLoading) {
        button.classList.add('loading');
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');

        // 保存原始文本
        if (!button.dataset.originalText) {
          button.dataset.originalText = button.textContent;
        }

        // 显示加载文本
        if (text) {
          button.textContent = text;
        } else {
          button.innerHTML = '<span class="btn-text">加载中...</span><span class="btn-spinner" aria-hidden="true"></span>';
        }
      } else {
        button.classList.remove('loading');
        button.disabled = false;
        button.setAttribute('aria-busy', 'false');

        // 恢复原始文本
        if (button.dataset.originalText) {
          button.textContent = button.dataset.originalText;
          delete button.dataset.originalText;
        }
      }
    }

    static setDisabled(button, disabled, reason = null) {
      button.disabled = disabled;
      if (disabled) {
        button.classList.add('disabled');
        button.setAttribute('aria-disabled', 'true');
        if (reason) {
          button.setAttribute('title', reason);
          button.setAttribute('aria-label', `${button.textContent} - ${reason}`);
        }
      } else {
        button.classList.remove('disabled');
        button.removeAttribute('aria-disabled');
        button.removeAttribute('title');
        button.removeAttribute('aria-label');
      }
    }

    static setSuccess(button, message = '成功', duration = 2000) {
      const originalText = button.textContent;
      button.classList.add('success');
      button.textContent = message;

      setTimeout(() => {
        button.classList.remove('success');
        button.textContent = originalText;
      }, duration);
    }

    static setError(button, message = '失败', duration = 2000) {
      const originalText = button.textContent;
      button.classList.add('error');
      button.textContent = message;

      setTimeout(() => {
        button.classList.remove('error');
        button.textContent = originalText;
      }, duration);
    }
  }

  // ==================== 进度指示器组件 ====================

  class ProgressIndicator {
    constructor(container) {
      this.container = container;
      this.isVisible = false;
    }

    show(title = '计算中...', steps = null) {
      this.container.innerHTML = `
        <div class="progress-overlay">
          <div class="progress-card">
            <div class="progress-header">
              <div class="progress-icon">
                <svg class="animate-spin" width="24" height="24" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-dasharray="60" stroke-dashoffset="60" opacity="0.3"/>
                  <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-dasharray="60" stroke-dashoffset="30"/>
                </svg>
              </div>
              <div class="progress-text">
                <h3 class="progress-title">${title}</h3>
                <p class="progress-message">请稍候，正在处理...</p>
              </div>
            </div>
            <div class="progress-bar-container">
              <div class="progress-bar">
                <div class="progress-fill" style="width: 0%"></div>
              </div>
              <span class="progress-percentage">0%</span>
            </div>
            ${steps ? this.createStepsHtml(steps) : ''}
          </div>
        </div>
      `;
      this.container.classList.add('active');
      this.isVisible = true;
    }

    createStepsHtml(steps) {
      const stepsHtml = steps.map((step, index) => `
        <div class="progress-step" data-step="${index}">
          <div class="step-indicator">
            <div class="step-number">${index + 1}</div>
            <div class="step-line"></div>
          </div>
          <div class="step-content">
            <div class="step-title">${step.title}</div>
            <div class="step-description">${step.description || ''}</div>
          </div>
        </div>
      `).join('');

      return `
        <div class="progress-steps">
          ${stepsHtml}
        </div>
      `;
    }

    updateProgress(percentage, message = null) {
      const fill = this.container.querySelector('.progress-fill');
      const percentageText = this.container.querySelector('.progress-percentage');
      const messageEl = this.container.querySelector('.progress-message');

      if (fill) {
        fill.style.width = `${percentage}%`;
      }
      if (percentageText) {
        percentageText.textContent = `${Math.round(percentage)}%`;
      }
      if (message && messageEl) {
        messageEl.textContent = message;
      }
    }

    updateStep(stepIndex, status = 'active') {
      const step = this.container.querySelector(`[data-step="${stepIndex}"]`);
      if (step) {
        step.classList.remove('active', 'completed', 'error');
        step.classList.add(status);
      }
    }

    completeStep(stepIndex) {
      this.updateStep(stepIndex, 'completed');
    }

    hide() {
      this.container.classList.remove('active');
      this.isVisible = false;
    }

    setError(message = '发生错误') {
      const icon = this.container.querySelector('.progress-icon');
      const messageEl = this.container.querySelector('.progress-message');

      if (icon) {
        icon.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="16" r="1" fill="currentColor"/></svg>';
      }
      if (messageEl) {
        messageEl.textContent = message;
      }
    }
  }

  // 创建进度指示器实例
  const progressIndicator = new ProgressIndicator(document.getElementById('progress-container'));

  // ==================== 数据验证管理器 ====================

  class ValidationManager {
    constructor() {
      this.errors = [];
      this.warnings = [];
    }

    // 主验证入口
    validate(topology) {
      this.errors = [];
      this.warnings = [];

      this.validateMeta(topology);
      this.validateNodes(topology);
      this.validateLinks(topology);
      this.validateConnectivity(topology);
      this.validateParameters(topology);

      return {
        errors: this.errors,
        warnings: this.warnings,
        isValid: this.errors.length === 0
      };
    }

    // 验证元数据
    validateMeta(topology) {
      const { meta } = topology;

      if (!meta) {
        this.errors.push('缺少 meta 元数据部分');
        return;
      }

      // 验证 baseMVA
      const baseMVA = Number(meta.baseMVA);
      if (!Number.isFinite(baseMVA) || baseMVA <= 0) {
        this.errors.push('meta.baseMVA 需设置为正数');
      } else if (baseMVA < 1 || baseMVA > 10000) {
        this.warnings.push(`meta.baseMVA 值 ${baseMVA} 超出建议范围 (1-10000)`);
      }

      // 验证 feeder
      if (!meta.feeder || typeof meta.feeder !== 'string') {
        this.errors.push('meta.feeder 需设置为非空字符串');
      }
    }

    // 验证节点
    validateNodes(topology) {
      const { nodes } = topology;

      if (!nodes || !Array.isArray(nodes)) {
        this.errors.push('nodes 需为数组');
        return;
      }

      if (nodes.length === 0) {
        this.errors.push('至少需要一个节点');
        return;
      }

      if (nodes.length > 1000) {
        this.warnings.push(`节点数量 ${nodes.length} 较多，可能影响性能`);
      }

      const nodeIds = new Set();
      const busNodes = [];
      const loadNodes = [];
      const genNodes = [];
      const dgNodes = [];

      nodes.forEach((node, index) => {
        const nodePath = `nodes[${index}]`;

        // 验证 ID
        if (!node.id) {
          this.errors.push(`${nodePath}: 缺少 id 字段`);
          return;
        }

        if (nodeIds.has(node.id)) {
          this.errors.push(`${nodePath}: id "${node.id}" 重复`);
        }
        nodeIds.add(node.id);

        // 验证类型
        if (!node.type) {
          this.errors.push(`${nodePath}: 缺少 type 字段`);
          return;
        }

        const validTypes = ['Bus', 'Load', 'Gen', 'DG', 'Transformer', 'Switch'];
        if (!validTypes.includes(node.type)) {
          this.errors.push(`${nodePath}: type "${node.type}" 无效 (应为: ${validTypes.join(', ')})`);
        }

        // 验证位置
        if (!node.loc || !Number.isFinite(node.loc.x) || !Number.isFinite(node.loc.y)) {
          this.warnings.push(`${nodePath}: 缺少或无效的位置信息 loc`);
        }

        // 按类型收集
        switch (node.type) {
          case 'Bus':
            busNodes.push(node);
            this.validateBusNode(node, nodePath);
            break;
          case 'Load':
            loadNodes.push(node);
            this.validateLoadNode(node, nodePath);
            break;
          case 'Gen':
            genNodes.push(node);
            this.validateGenNode(node, nodePath);
            break;
          case 'DG':
            dgNodes.push(node);
            this.validateDGNode(node, nodePath);
            break;
          case 'Transformer':
            this.validateTransformerNode(node, nodePath);
            break;
          case 'Switch':
            this.validateSwitchNode(node, nodePath);
            break;
        }
      });

      // 验证必须有至少一个母线
      if (busNodes.length === 0) {
        this.errors.push('至少需要一个母线 (Bus) 节点');
      }

      // 验证有且仅有一个平衡节点
      const slackBuses = busNodes.filter(bus => bus.data?.is_slack);
      if (slackBuses.length === 0) {
        this.errors.push('至少需要一个平衡节点 (is_slack: true)');
      } else if (slackBuses.length > 1) {
        this.warnings.push(`有 ${slackBuses.length} 个平衡节点，建议只保留一个`);
      }

      // 验证负荷和电源平衡
      const totalLoadP = loadNodes.reduce((sum, load) => sum + (Number(load.data?.p_kw) || 0), 0);
      const totalGenP = [...genNodes, ...dgNodes].reduce((sum, gen) => {
        const p = Number(gen.data?.p_kw) || 0;
        return sum + (gen.data?.status === 1 ? p : 0);
      }, 0);

      if (totalLoadP > 0 && totalGenP === 0) {
        this.warnings.push('有负荷但没有投入运行的电源');
      }

      if (totalLoadP > totalGenP * 1.2) {
        this.warnings.push('总负荷可能超过总电源容量');
      }
    }

    // 验证母线节点
    validateBusNode(node, path) {
      const { data } = node;

      if (!data) {
        this.errors.push(`${path}: Bus 节点缺少 data 字段`);
        return;
      }

      // 验证电压等级
      const kv = Number(data.kv);
      if (!Number.isFinite(kv) || kv <= 0) {
        this.errors.push(`${path}: Bus.kv 需为正数`);
      } else if (kv < 0.1 || kv > 1000) {
        this.warnings.push(`${path}: Bus.kv 值 ${kv} 超出常见范围 (0.1-1000 kV)`);
      }

      // 验证电压幅值
      const vm = Number(data.vm_pu);
      if (data.vm_pu !== undefined) {
        if (!Number.isFinite(vm) || vm <= 0) {
          this.errors.push(`${path}: Bus.vm_pu 需为正数`);
        } else if (vm < 0.9 || vm > 1.1) {
          this.warnings.push(`${path}: Bus.vm_pu 值 ${vm} 超出正常范围 (0.9-1.1)`);
        }
      }

      // 验证电压角度
      const va = Number(data.va_deg);
      if (data.va_deg !== undefined && !Number.isFinite(va)) {
        this.errors.push(`${path}: Bus.va_deg 需为数值`);
      }
    }

    // 验证负荷节点
    validateLoadNode(node, path) {
      const { data, bus } = node;

      if (!data) {
        this.errors.push(`${path}: Load 节点缺少 data 字段`);
        return;
      }

      if (!bus) {
        this.errors.push(`${path}: Load 节点缺少 bus 字段`);
      }

      // 验证有功功率
      const p = Number(data.p_kw);
      if (!Number.isFinite(p) || p < 0) {
        this.errors.push(`${path}: Load.p_kw 需为非负数`);
      } else if (p > 100000) {
        this.warnings.push(`${path}: Load.p_kw 值 ${p} 过大`);
      }

      // 验证无功功率
      const q = Number(data.q_kvar);
      if (data.q_kvar !== undefined && (!Number.isFinite(q) || q < 0)) {
        this.errors.push(`${path}: Load.q_kvar 需为非负数`);
      }
    }

    // 验证发电机节点
    validateGenNode(node, path) {
      const { data, bus } = node;

      if (!data) {
        this.errors.push(`${path}: Gen 节点缺少 data 字段`);
        return;
      }

      if (!bus) {
        this.errors.push(`${path}: Gen 节点缺少 bus 字段`);
      }

      // 验证有功功率
      const p = Number(data.p_kw);
      if (!Number.isFinite(p)) {
        this.errors.push(`${path}: Gen.p_kw 需为数值`);
      }

      // 验证功率范围
      const pMin = Number(data.p_min_kw);
      const pMax = Number(data.p_max_kw);
      if (Number.isFinite(pMin) && Number.isFinite(pMax) && pMin > pMax) {
        this.errors.push(`${path}: Gen.p_min_kw 不能大于 p_max_kw`);
      }

      // 验证状态
      const status = Number(data.status);
      if (data.status !== undefined && ![0, 1].includes(status)) {
        this.errors.push(`${path}: Gen.status 需为 0 或 1`);
      }
    }

    // 验证分布式电源节点
    validateDGNode(node, path) {
      const { data, bus } = node;

      if (!data) {
        this.errors.push(`${path}: DG 节点缺少 data 字段`);
        return;
      }

      if (!bus) {
        this.errors.push(`${path}: DG 节点缺少 bus 字段`);
      }

      // 验证有功功率
      const p = Number(data.p_kw);
      if (!Number.isFinite(p) || p < 0) {
        this.errors.push(`${path}: DG.p_kw 需为非负数`);
      } else if (p > 50000) {
        this.warnings.push(`${path}: DG.p_kw 值 ${p} 过大`);
      }

      // 验证状态
      const status = Number(data.status);
      if (data.status !== undefined && ![0, 1].includes(status)) {
        this.errors.push(`${path}: DG.status 需为 0 或 1`);
      }
    }

    // 验证变压器节点
    validateTransformerNode(node, path) {
      const { data } = node;

      if (!data) {
        this.warnings.push(`${path}: Transformer 节点缺少 data 字段`);
        return;
      }

      // 验证分接头
      const tap = Number(data.tap);
      if (data.tap !== undefined && (!Number.isFinite(tap) || tap <= 0)) {
        this.errors.push(`${path}: Transformer.tap 需为正数`);
      }

      // 验证相位偏移
      const shift = Number(data.shift_deg);
      if (data.shift_deg !== undefined && !Number.isFinite(shift)) {
        this.errors.push(`${path}: Transformer.shift_deg 需为数值`);
      }
    }

    // 验证开关节点
    validateSwitchNode(node, path) {
      const { data } = node;

      if (!data) {
        this.warnings.push(`${path}: Switch 节点缺少 data 字段`);
        return;
      }

      // 验证状态
      const status = data.status;
      if (status !== undefined && !['CLOSED', 'OPEN'].includes(status)) {
        this.errors.push(`${path}: Switch.status 需为 'CLOSED' 或 'OPEN'`);
      }

      // 验证阻抗
      const r = Number(data.r_ohm);
      const x = Number(data.x_ohm);
      if (data.r_ohm !== undefined && (!Number.isFinite(r) || r < 0)) {
        this.errors.push(`${path}: Switch.r_ohm 需为非负数`);
      }
      if (data.x_ohm !== undefined && (!Number.isFinite(x) || x < 0)) {
        this.errors.push(`${path}: Switch.x_ohm 需为非负数`);
      }
    }

    // 验证连接
    validateLinks(topology) {
      const { links } = topology;

      if (!links || !Array.isArray(links)) {
        this.warnings.push('links 需为数组');
        return;
      }

      if (links.length > 2000) {
        this.warnings.push(`连接数量 ${links.length} 较多，可能影响性能`);
      }

      const linkIds = new Set();
      const nodeIds = new Set((topology.nodes || []).map(n => n.id));

      links.forEach((link, index) => {
        const linkPath = `links[${index}]`;

        // 验证 ID
        if (!link.id) {
          this.errors.push(`${linkPath}: 缺少 id 字段`);
          return;
        }

        if (linkIds.has(link.id)) {
          this.errors.push(`${linkPath}: id "${link.id}" 重复`);
        }
        linkIds.add(link.id);

        // 验证连接节点
        if (!link.from) {
          this.errors.push(`${linkPath}: 缺少 from 字段`);
        } else if (!nodeIds.has(link.from)) {
          this.errors.push(`${linkPath}: from 节点 "${link.from}" 不存在`);
        }

        if (!link.to) {
          this.errors.push(`${linkPath}: 缺少 to 字段`);
        } else if (!nodeIds.has(link.to)) {
          this.errors.push(`${linkPath}: to 节点 "${link.to}" 不存在`);
        }

        // 验证不能自连
        if (link.from && link.to && link.from === link.to) {
          this.errors.push(`${linkPath}: 不能连接同一节点 (from === to)`);
        }

        // 验证类型
        if (!link.type) {
          this.warnings.push(`${linkPath}: 缺少 type 字段`);
        }
      });
    }

    // 验证连通性
    validateConnectivity(topology) {
      const { nodes, links } = topology;
      if (!nodes || !links) return;

      const nodeMap = new Map(nodes.map(n => [n.id, n]));
      const connectedNodes = new Set();
      const unconnectedNodes = new Set(nodes.map(n => n.id));

      // BFS遍历连通分量
      links.forEach(link => {
        if (nodeMap.has(link.from) && nodeMap.has(link.to)) {
          connectedNodes.add(link.from);
          connectedNodes.add(link.to);
        }
      });

      // 检查孤立节点
      connectedNodes.forEach(id => unconnectedNodes.delete(id));

      if (unconnectedNodes.size > 0) {
        const isolated = Array.from(unconnectedNodes).slice(0, 5);
        const more = unconnectedNodes.size > 5 ? ` 等${unconnectedNodes.size}个` : '';
        this.warnings.push(`发现孤立节点: ${isolated.join(', ')}${more}`);
      }
    }

    // 验证参数完整性
    validateParameters(topology) {
      const { nodes, links } = topology;

      // 检查节点参数完整性
      nodes?.forEach((node, index) => {
        const path = `nodes[${index}]`;

        // 检查必需参数
        switch (node.type) {
          case 'Load':
            if (node.data?.p_kw === undefined) {
              this.errors.push(`${path}: Load 缺少必需参数 p_kw`);
            }
            break;
          case 'Gen':
          case 'DG':
            if (node.data?.p_kw === undefined) {
              this.errors.push(`${path}: ${node.type} 缺少必需参数 p_kw`);
            }
            if (node.data?.bus === undefined) {
              this.warnings.push(`${path}: ${node.type} 建议指定 bus 参数`);
            }
            break;
        }
      });

      // 检查连接参数
      links?.forEach((link, index) => {
        const path = `links[${index}]`;

        if (link.type === 'Line' || link.type === 'Switch') {
          const r = Number(link.data?.r_ohm);
          const x = Number(link.data?.x_ohm);
          const b = Number(link.data?.b_shunt);

          if (!Number.isFinite(r)) {
            this.warnings.push(`${path}: 建议设置 r_ohm 参数`);
          }
          if (!Number.isFinite(x)) {
            this.warnings.push(`${path}: 建议设置 x_ohm 参数`);
          }
          if (b !== undefined && !Number.isFinite(b)) {
            this.errors.push(`${path}: b_shunt 需为数值`);
          }
        }
      });
    }
  }

  // 创建验证管理器实例
  const validationManager = new ValidationManager();

  // ==================== 验证结果对话框 ====================

  class ValidationDialog {
    constructor() {
      this.dialog = document.getElementById('validation-dialog');
      this.btnClose = document.getElementById('validation-close');
      this.btnContinue = document.getElementById('validation-continue');
      this.btnCancel = document.getElementById('validation-cancel');
      this.content = document.getElementById('validation-content');
      this.summary = document.getElementById('validation-summary');
      this.errorsList = document.getElementById('validation-errors');
      this.warningsList = document.getElementById('validation-warnings');
      this.countErrors = document.getElementById('count-errors');
      this.countWarnings = document.getElementById('count-warnings');

      this.callback = null;

      this.bindEvents();
    }

    bindEvents() {
      this.btnClose.addEventListener('click', () => this.hide());
      this.btnCancel.addEventListener('click', () => this.hide());
      this.btnContinue.addEventListener('click', () => {
        if (this.callback) this.callback(true);
        this.hide();
      });

      // 点击背景关闭
      this.dialog.addEventListener('click', (e) => {
        if (e.target === this.dialog) {
          this.hide();
        }
      });

      // ESC 键关闭
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.dialog.classList.contains('active')) {
          this.hide();
        }
      });
    }

    show(validationResult, callback = null) {
      this.callback = callback;

      this.content.innerHTML = this.createContent(validationResult);
      this.dialog.classList.add('active');
      this.dialog.setAttribute('aria-hidden', 'false');

      // 聚焦到继续按钮
      setTimeout(() => {
        this.btnContinue.focus();
      }, 100);
    }

    hide() {
      this.dialog.classList.remove('active');
      this.dialog.setAttribute('aria-hidden', 'true');
      this.callback = null;
    }

    createContent(result) {
      const { errors, warnings, isValid } = result;

      // 更新统计
      this.countErrors.textContent = errors.length;
      this.countWarnings.textContent = warnings.length;

      // 创建错误列表
      const errorsHtml = errors.length > 0
        ? errors.map((error, index) => `
            <div class="validation-item error">
              <div class="validation-icon">❌</div>
              <div class="validation-text">${this.escapeHtml(error)}</div>
              <button class="validation-jump" onclick="window.jointCanvas?.jumpToError(${index})" title="跳转到错误位置">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                  <path d="M7 0L0 7l7 7v-4h4V3L7 0z"/>
                </svg>
              </button>
            </div>
          `).join('')
        : '<div class="validation-empty">✅ 没有发现错误</div>';

      // 创建警告列表
      const warningsHtml = warnings.length > 0
        ? warnings.map((warning, index) => `
            <div class="validation-item warning">
              <div class="validation-icon">⚠️</div>
              <div class="validation-text">${this.escapeHtml(warning)}</div>
            </div>
          `).join('')
        : '<div class="validation-empty">✅ 没有警告</div>';

      // 创建摘要
      const summaryHtml = `
        <div class="validation-summary-item ${errors.length > 0 ? 'has-errors' : ''}">
          <div class="summary-icon">${errors.length > 0 ? '❌' : '✅'}</div>
          <div class="summary-text">
            <div class="summary-title">${errors.length} 个错误</div>
            <div class="summary-desc">${errors.length > 0 ? '需要修复后才能计算' : '拓扑结构正确'}</div>
          </div>
        </div>
        <div class="validation-summary-item ${warnings.length > 0 ? 'has-warnings' : ''}">
          <div class="summary-icon">${warnings.length > 0 ? '⚠️' : '✅'}</div>
          <div class="summary-text">
            <div class="summary-title">${warnings.length} 个警告</div>
            <div class="summary-desc">${warnings.length > 0 ? '建议优化以提高精度' : '参数设置良好'}</div>
          </div>
        </div>
      `;

      this.summary.innerHTML = summaryHtml;
      this.errorsList.innerHTML = errorsHtml;
      this.warningsList.innerHTML = warningsHtml;

      return '';
    }

    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
  }

  // 创建验证对话框实例
  const validationDialog = new ValidationDialog();

  // ==================== 帮助系统 ====================

  class HelpSystem {
    constructor() {
      this.dialog = document.getElementById('help-dialog');
      this.btnClose = document.getElementById('help-close');
      this.content = document.getElementById('help-content');
      this.searchInput = document.getElementById('help-search');
      this.tabs = document.querySelectorAll('.help-tab');

      this.currentTab = 'getting-started';

      this.bindEvents();
      this.initContent();
    }

    bindEvents() {
      this.btnClose.addEventListener('click', () => this.hide());
      this.dialog.addEventListener('click', (e) => {
        if (e.target === this.dialog) this.hide();
      });

      // Tab切换
      this.tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          const tabId = tab.dataset.tab;
          this.switchTab(tabId);
        });
      });

      // 搜索
      this.searchInput.addEventListener('input', (e) => {
        this.search(e.target.value);
      });

      // ESC关闭
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.dialog.classList.contains('active')) {
          this.hide();
        }
      });
    }

    initContent() {
      const helpContent = {
        'getting-started': {
          title: '快速开始',
          icon: '🚀',
          content: `
            <div class="help-section">
              <h3>欢迎使用 Julia-Grid Designer & Optimizer</h3>
              <p>这是一个专业的电力系统设计软件，用于潮流计算和拓扑优化。</p>
            </div>

            <div class="help-section">
              <h4>基本操作流程</h4>
              <ol>
                <li><strong>添加节点</strong>: 从左侧调色板选择节点类型，点击画布添加</li>
                <li><strong>连接节点</strong>: 拖拽连接线将节点连接起来</li>
                <li><strong>设置参数</strong>: 双击节点编辑参数（如负荷功率、发电机出力等）</li>
                <li><strong>运行计算</strong>: 点击"运行潮流"进行潮流计算</li>
                <li><strong>查看结果</strong>: 在右侧面板查看计算结果</li>
              </ol>
            </div>

            <div class="help-section">
              <h4>节点类型说明</h4>
              <ul>
                <li><strong>Bus (母线)</strong>: 电力系统中的连接点，需设置电压等级</li>
                <li><strong>Load (负荷)</strong>: 消耗电能的设备，需设置有功/无功功率</li>
                <li><strong>Gen (发电机)</strong>: 产生电能的设备，需设置出力范围</li>
                <li><strong>DG (分布式电源)</strong>: 小型发电设备，如太阳能、风能</li>
                <li><strong>Transformer (变压器)</strong>: 改变电压等级</li>
                <li><strong>Switch (开关)</strong>: 控制电路通断</li>
              </ul>
            </div>
          `
        },
        'shortcuts': {
          title: '快捷键',
          icon: '⌨️',
          content: `
            <div class="help-section">
              <h3>快捷键列表</h3>
              <div class="shortcut-list">
                <div class="shortcut-item">
                  <div class="shortcut-keys">
                    <kbd>Delete</kbd>
                    <kbd>Backspace</kbd>
                  </div>
                  <div class="shortcut-desc">删除选中的节点</div>
                </div>

                <div class="shortcut-item">
                  <div class="shortcut-keys">
                    <kbd>Ctrl</kbd> + <kbd>Z</kbd>
                  </div>
                  <div class="shortcut-desc">撤销操作</div>
                </div>

                <div class="shortcut-item">
                  <div class="shortcut-keys">
                    <kbd>Ctrl</kbd> + <kbd>Y</kbd>
                  </div>
                  <div class="shortcut-desc">重做操作</div>
                </div>

                <div class="shortcut-item">
                  <div class="shortcut-keys">
                    <kbd>Ctrl</kbd> + <kbd>A</kbd>
                  </div>
                  <div class="shortcut-desc">全选节点</div>
                </div>

                <div class="shortcut-item">
                  <div class="shortcut-keys">
                    <kbd>Ctrl</kbd> + <kbd>D</kbd>
                  </div>
                  <div class="shortcut-desc">复制选中节点</div>
                </div>

                <div class="shortcut-item">
                  <div class="shortcut-keys">
                    <kbd>Ctrl</kbd> + <kbd>S</kbd>
                  </div>
                  <div class="shortcut-desc">保存拓扑</div>
                </div>

                <div class="shortcut-item">
                  <div class="shortcut-keys">
                    <kbd>Ctrl</kbd> + <kbd>O</kbd>
                  </div>
                  <div class="shortcut-desc">打开拓扑</div>
                </div>

                <div class="shortcut-item">
                  <div class="shortcut-keys">
                    <kbd>Ctrl</kbd> + <kbd>+</kbd>
                  </div>
                  <div class="shortcut-desc">放大画布</div>
                </div>

                <div class="shortcut-item">
                  <div class="shortcut-keys">
                    <kbd>Ctrl</kbd> + <kbd>-</kbd>
                  </div>
                  <div class="shortcut-desc">缩小画布</div>
                </div>

                <div class="shortcut-item">
                  <div class="shortcut-keys">
                    <kbd>Ctrl</kbd> + <kbd>0</kbd>
                  </div>
                  <div class="shortcut-desc">重置缩放</div>
                </div>

                <div class="shortcut-item">
                  <div class="shortcut-keys">
                    <kbd>F1</kbd>
                  </div>
                  <div class="shortcut-desc">打开帮助</div>
                </div>

                <div class="shortcut-item">
                  <div class="shortcut-keys">
                    <kbd>ESC</kbd>
                  </div>
                  <div class="shortcut-desc">关闭对话框/取消操作</div>
                </div>
              </div>
            </div>
          `
        },
        'tutorials': {
          title: '教程',
          icon: '📚',
          content: `
            <div class="help-section">
              <h3>完整教程</h3>

              <div class="tutorial-item">
                <h4>教程 1: 创建简单配电网络</h4>
                <p>学习如何创建一个基础的配电网络，包括电源、负荷和连接线。</p>
                <ol>
                  <li>添加一个母线作为平衡节点 (Bus)，设置 is_slack: true</li>
                  <li>添加负荷节点 (Load)，连接到母线</li>
                  <li>添加发电机 (Gen)，连接到母线</li>
                  <li>设置各节点的参数</li>
                  <li>运行潮流计算查看结果</li>
                </ol>
              </div>

              <div class="tutorial-item">
                <h4>教程 2: 分布式电源优化</h4>
                <p>学习如何添加和配置分布式电源，优化网络性能。</p>
                <ol>
                  <li>创建基础网络拓扑</li>
                  <li>在负荷附近添加分布式电源 (DG)</li>
                  <li>设置 DG 的出力参数</li>
                  <li>运行拓扑重构与 DG 优化</li>
                  <li>对比优化前后的潮流分布</li>
                </ol>
              </div>

              <div class="tutorial-item">
                <h4>教程 3: 开关操作与网络重构</h4>
                <p>学习如何通过开关操作实现网络重构，降低损耗。</p>
                <ol>
                  <li>创建环网结构</li>
                  <li>添加多个开关 (Switch)</li>
                  <li>设置开关的开合状态</li>
                  <li>测试不同的开关配置</li>
                  <li>分析网络损耗和电压分布</li>
                </ol>
              </div>
            </div>
          `
        },
        'troubleshooting': {
          title: '故障排除',
          icon: '🔧',
          content: `
            <div class="help-section">
              <h3>常见问题</h3>

              <div class="faq-item">
                <h4>Q: 计算失败怎么办？</h4>
                <p><strong>A:</strong> 检查以下几点：</p>
                <ul>
                  <li>确保有至少一个平衡节点 (is_slack: true)</li>
                  <li>检查所有必需参数是否已设置</li>
                  <li>验证网络是否连通</li>
                  <li>查看验证报告中的错误信息</li>
                </ul>
              </div>

              <div class="faq-item">
                <h4>Q: 节点无法连接？</h4>
                <p><strong>A:</strong> 确认：</p>
                <ul>
                  <li>两个节点都已添加到画布</li>
                  <li>不是同一节点自连</li>
                  <li>节点未被锁定</li>
                </ul>
              </div>

              <div class="faq-item">
                <h4>Q: 如何删除节点？</h4>
                <p><strong>A:</strong> 选中节点后按 Delete 键或 Backspace 键</p>
              </div>

              <div class="faq-item">
                <h4>Q: 结果不收敛？</h4>
                <p><strong>A:</strong> 尝试：</p>
                <ul>
                  <li>检查初始参数是否合理</li>
                  <li>调整平衡节点设置</li>
                  <li>检查负荷和电源平衡</li>
                  <li>增加迭代次数限制</li>
                </ul>
              </div>

              <div class="faq-item">
                <h4>Q: 如何保存工作？</h4>
                <p><strong>A:</strong> 点击"导出 JSON"按钮，或使用 Ctrl+S</p>
              </div>

              <div class="faq-item">
                <h4>Q: 图例有什么用？</h4>
                <p><strong>A:</strong> 图例显示所有节点类型说明，点击高亮按钮可快速定位同类型节点</p>
              </div>
            </div>
          `
        }
      };

      this.helpContent = helpContent;
    }

    show() {
      this.dialog.classList.add('active');
      this.dialog.setAttribute('aria-hidden', 'false');
      this.switchTab(this.currentTab);
      setTimeout(() => {
        this.searchInput.focus();
      }, 100);
    }

    hide() {
      this.dialog.classList.remove('active');
      this.dialog.setAttribute('aria-hidden', 'true');
    }

    switchTab(tabId) {
      this.currentTab = tabId;

      // 更新tab状态
      this.tabs.forEach(tab => {
        if (tab.dataset.tab === tabId) {
          tab.classList.add('active');
        } else {
          tab.classList.remove('active');
        }
      });

      // 更新内容
      const content = this.helpContent[tabId];
      if (content) {
        this.content.innerHTML = `
          <div class="help-header">
            <div class="help-title">
              <span class="help-icon">${content.icon}</span>
              <h2>${content.title}</h2>
            </div>
          </div>
          <div class="help-body">
            ${content.content}
          </div>
        `;
      }
    }

    search(query) {
      if (!query) {
        this.switchTab(this.currentTab);
        return;
      }

      // 简单搜索实现
      const results = [];
      Object.entries(this.helpContent).forEach(([key, content]) => {
        if (content.title.toLowerCase().includes(query.toLowerCase()) ||
            content.content.toLowerCase().includes(query.toLowerCase())) {
          results.push({ key, ...content });
        }
      });

      if (results.length > 0) {
        this.content.innerHTML = `
          <div class="help-header">
            <div class="help-title">
              <span class="help-icon">🔍</span>
              <h2>搜索结果</h2>
            </div>
            <p class="search-query">搜索: "${query}" (${results.length} 个结果)</p>
          </div>
          <div class="help-body">
            ${results.map(result => `
              <div class="search-result-item" onclick="helpSystem.switchTab('${result.key}')">
                <div class="result-icon">${result.icon}</div>
                <div class="result-content">
                  <h4>${result.title}</h4>
                  <p>${result.content.substring(0, 100)}...</p>
                </div>
              </div>
            `).join('')}
          </div>
        `;
      } else {
        this.content.innerHTML = `
          <div class="help-header">
            <div class="help-title">
              <span class="help-icon">🔍</span>
              <h2>搜索结果</h2>
            </div>
          </div>
          <div class="help-body">
            <div class="no-results">
              <p>没有找到相关内容</p>
              <p>尝试使用其他关键词</p>
            </div>
          </div>
        `;
      }
    }
  }

  // 创建帮助系统实例
  const helpSystem = new HelpSystem();

  // 工具提示组件

  class TooltipManager {
    constructor() {
      this.tooltips = new Map();
      this.init();
    }

    init() {
      // 事件委托处理所有带data-tooltip的元素
      document.addEventListener('mouseenter', (e) => {
        if (e.target.hasAttribute('data-tooltip')) {
          this.show(e.target, e.target.getAttribute('data-tooltip'));
        }
      }, true);

      document.addEventListener('mouseleave', (e) => {
        if (e.target.hasAttribute('data-tooltip')) {
          this.hide(e.target);
        }
      }, true);

      document.addEventListener('focusin', (e) => {
        if (e.target.hasAttribute('data-tooltip')) {
          this.show(e.target, e.target.getAttribute('data-tooltip'));
        }
      });

      document.addEventListener('focusout', (e) => {
        if (e.target.hasAttribute('data-tooltip')) {
          this.hide(e.target);
        }
      });
    }

    show(element, text) {
      if (this.tooltips.has(element)) {
        return;
      }

      const tooltip = document.createElement('div');
      tooltip.className = 'tooltip';
      tooltip.textContent = text;
      document.body.appendChild(tooltip);

      // 定位
      const rect = element.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();

      let top = rect.top - tooltipRect.height - 8;
      let left = rect.left + (rect.width - tooltipRect.width) / 2;

      // 边界检查
      if (top < 0) {
        top = rect.bottom + 8;
        tooltip.classList.add('tooltip-bottom');
      } else {
        tooltip.classList.add('tooltip-top');
      }

      if (left < 0) {
        left = 8;
      } else if (left + tooltipRect.width > window.innerWidth) {
        left = window.innerWidth - tooltipRect.width - 8;
      }

      tooltip.style.top = `${top}px`;
      tooltip.style.left = `${left}px`;
      tooltip.classList.add('tooltip-visible');

      this.tooltips.set(element, tooltip);
    }

    hide(element) {
      const tooltip = this.tooltips.get(element);
      if (tooltip) {
        tooltip.classList.remove('tooltip-visible');
        setTimeout(() => {
          tooltip.remove();
          this.tooltips.delete(element);
        }, 150);
      }
    }

    hideAll() {
      this.tooltips.forEach((tooltip, element) => {
        this.hide(element);
      });
    }
  }

  // 初始化工具提示管理器
  const tooltipManager = new TooltipManager();

  // ==================== 初始化JointJS画布 ====================

  // 创建图形模型
  const graph = new joint.dia.Graph();

  // 创建画布
  const paper = new joint.dia.Paper({
    el: document.getElementById('diagram'),
    model: graph,
    width: '100%',
    height: '100%',
    gridSize: 20,
    drawGrid: {
      name: 'dot',
      args: { color: '#e0e0e0', thickness: 1 }
    },
    defaultLink: new joint.dia.Link({
      attrs: {
        '.marker-source': { d: 'M 0 0 L 0 0 L 0 0 z' },
        '.marker-target': { d: 'M 10 0 L 0 5 L 0 -5 z', fill: '#546e7a' },
        '.connection': { stroke: '#546e7a', strokeWidth: 2 }
      }
    }),
    linkTool: true,
    defaultConnectionPoint: 'anchor',
    defaultLinkAnchor: 'center',
    interactive: function(elementView) {
      if (elementView.model.get('isReadOnly')) return false;
      return { elementMove: true, arrowheadMove: false };
    }
  });

  // ==================== 调色板 ====================

  function createPaletteItem(type, definition) {
    const $ = joint.shapes.basic;

    let shape;
    const commonAttrs = {
      fill: '#fff',
      stroke: definition.color,
      strokeWidth: 2
    };

    switch (definition.shape) {
      case 'circle':
        shape = new $.Circle({
          size: definition.size,
          attrs: { ...commonAttrs, ...definition }
        });
        break;
      case 'diamond':
        shape = new $.Rhombus({
          size: definition.size,
          attrs: { ...commonAttrs, ...definition }
        });
        break;
      case 'rounded-rect':
        shape = new $.Rect({
          size: definition.size,
          attrs: { ...commonAttrs, ...definition }
        });
        break;
      default:
        shape = new $.Rect({
          size: definition.size,
          attrs: { ...commonAttrs, ...definition }
        });
    }

    shape.set({
      id: type,
      type: type,
      isPaletteItem: true
    });

    return shape;
  }

  // 渲染调色板
  function renderPalette() {
    const paletteContainer = document.getElementById('palette');
    const palette = document.createElement('div');
    palette.className = 'palette-items';

    // 节点类型描述
    const typeDescriptions = {
      Bus: '电力系统中的母线或节点，用于连接其他设备',
      Load: '电力负荷，消耗电能的设备或区域',
      Gen: '发电机组，产生电能的设备',
      DG: '分布式电源，如太阳能、风能等小型发电设备',
      Transformer: '变压器，用于改变电压等级',
      Switch: '开关设备，用于控制电路的通断'
    };

    Object.entries(NODE_DEFINITIONS).forEach(([type, definition]) => {
      const item = document.createElement('div');
      item.className = 'palette-item';
      item.dataset.type = type;
      item.dataset.tooltip = typeDescriptions[type] || `${type} 节点`;
      item.textContent = type;
      item.addEventListener('click', () => addNodeToCanvas(type));
      palette.appendChild(item);
    });

    paletteContainer.appendChild(palette);
  }

  // ==================== 添加节点 ====================

  function addNodeToCanvas(type) {
    const definition = NODE_DEFINITIONS[type];
    if (!definition) return;

    const $ = joint.shapes.basic;
    let element;

    const position = { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 };
    const commonAttrs = {
      fill: '#fff',
      stroke: definition.color,
      strokeWidth: 2
    };

    switch (definition.shape) {
      case 'circle':
        element = new $.Circle({
          position,
          size: definition.size,
          attrs: commonAttrs
        });
        break;
      case 'diamond':
        element = new $.Rhombus({
          position,
          size: definition.size,
          attrs: commonAttrs
        });
        break;
      case 'rounded-rect':
        element = new $.Rect({
          position,
          size: definition.size,
          attrs: { ...commonAttrs }
        });
        break;
      default:
        element = new $.Rect({
          position,
          size: definition.size,
          attrs: commonAttrs
        });
    }

    element.set({
      id: generateId(),
      type: type,
      name: type,
      data: getDefaultData(type)
    });

    graph.addCell(element);

    // 添加创建动画
    setTimeout(() => {
      const cellView = paper.findViewByModel(element);
      if (cellView) {
        cellView.el.classList.add('new-element');
        // 动画结束后移除类
        setTimeout(() => {
          cellView.el.classList.remove('new-element');
        }, 500);
      }
    }, 10);
  }

  function getDefaultData(type) {
    const defaults = {
      Bus: { kv: 10.5, is_slack: false, vm_pu: 1.0, va_deg: 0.0 },
      Load: { p_kw: 500, q_kvar: 200, bus: '' },
      Gen: { p_kw: 500, p_max_kw: 800, p_min_kw: 0, status: 1, bus: '' },
      DG: { p_kw: 200, p_max_kw: 400, p_min_kw: 0, status: 1, bus: '' },
      Transformer: { tap: 1.0, shift_deg: 0.0 },
      Switch: { status: 'CLOSED', r_ohm: 0.0, x_ohm: 0.0 }
    };
    return defaults[type] || {};
  }

  // ==================== 节点编辑和选择 ====================

  let selectedElement = null;

  paper.on('cell:pointerdown', function(cellView) {
    if (cellView.model instanceof joint.dia.Link) return;

    const element = cellView.model;
    const type = element.get('type');

    // 清除之前的选择
    clearSelection();

    // 设置新的选择
    selectedElement = element;
    cellView.el.classList.add('selected');

    // 创建编辑对话框
    openInspector(element, type);
  });

  // 清除所有选择
  function clearSelection() {
    if (selectedElement) {
      const cellView = paper.findViewByModel(selectedElement);
      if (cellView) {
        cellView.el.classList.remove('selected');
      }
      selectedElement = null;
    }
  }

  // 点击空白区域清除选择
  paper.on('blank:pointerdown', function() {
    clearSelection();
  });

  // 键盘删除选中节点
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedElement && !parameterEditor.isOpen) {
        const cellView = paper.findViewByModel(selectedElement);
        if (cellView) {
          // 添加删除动画
          cellView.el.classList.add('removing');
          setTimeout(() => {
            graph.removeCell(selectedElement);
            selectedElement = null;
          }, 300);
        }
      }
    }
  });

  // ==================== 参数编辑对话框 ====================

  function openInspector(element, type) {
    // 使用新的参数编辑对话框
    parameterEditor.open(element, type);
  }

  // ==================== 连接线 ====================

  paper.on('blank:pointerdown', function(evt, x, y) {
    const link = new joint.dia.Link({
      source: { x: x, y: y },
      target: { x: x + 100, y: y }
    });
    graph.addCell(link);
  });

  paper.on('link:complete', function(linkView) {
    // 连接完成后的处理
  });

  // ==================== JSON导入导出 ====================

  function exportTopology() {
    const cells = graph.getElements();
    const links = graph.getLinks();

    const nodes = cells.map(cell => ({
      id: cell.id,
      type: cell.get('type'),
      name: cell.get('name'),
      loc: cell.get('position'),
      data: cell.get('data')
    }));

    const topologyLinks = links.map(link => ({
      id: link.id,
      from: link.getSourceElement().id,
      to: link.getTargetElement().id,
      type: 'Line',
      data: link.get('data') || {}
    }));

    return {
      meta: {
        baseMVA: 100,
        feeder: 'F1'
      },
      nodes,
      links: topologyLinks
    };
  }

  function importTopology(topology) {
    graph.clear();

    // 导入节点
    const nodeMap = {};
    (topology.nodes || []).forEach(nodeData => {
      const element = createNodeFromData(nodeData);
      graph.addCell(element);
      nodeMap[nodeData.id] = element;
    });

    // 导入连线
    (topology.links || []).forEach(linkData => {
      if (nodeMap[linkData.from] && nodeMap[linkData.to]) {
        const link = new joint.dia.Link({
          source: { id: nodeMap[linkData.from].id },
          target: { id: nodeMap[linkData.to].id }
        });
        graph.addCell(link);
      }
    });
  }

  function createNodeFromData(nodeData) {
    const $ = joint.shapes.basic;
    const definition = NODE_DEFINITIONS[nodeData.type] || NODE_DEFINITIONS.Bus;

    const position = nodeData.loc || { x: 100, y: 100 };
    const commonAttrs = {
      fill: '#fff',
      stroke: definition.color,
      strokeWidth: 2
    };

    let element;
    switch (definition.shape) {
      case 'circle':
        element = new $.Circle({
          position,
          size: definition.size,
          attrs: commonAttrs
        });
        break;
      case 'diamond':
        element = new $.Rhombus({
          position,
          size: definition.size,
          attrs: commonAttrs
        });
        break;
      case 'rounded-rect':
        element = new $.Rect({
          position,
          size: definition.size,
          attrs: { ...commonAttrs }
        });
        break;
      default:
        element = new $.Rect({
          position,
          size: definition.size,
          attrs: commonAttrs
        });
    }

    element.set({
      id: nodeData.id,
      type: nodeData.type,
      name: nodeData.name || nodeData.type,
      data: nodeData.data || {}
    });

    return element;
  }

  // ==================== UI事件绑定 ====================

  function bindUiEvents() {
    const btnHelp = document.getElementById('btn-help');
    const btnLegend = document.getElementById('btn-legend');
    const btnZoomIn = document.getElementById('btn-zoom-in');
    const btnZoomOut = document.getElementById('btn-zoom-out');
    const btnZoomReset = document.getElementById('btn-zoom-reset');
    const btnLoad = document.getElementById('btn-load-topology');
    const btnSave = document.getElementById('btn-save-topology');
    const btnRunPf = document.getElementById('btn-run-pf');
    const btnRunOpt = document.getElementById('btn-run-optimization');

    // 绑定事件
    btnHelp.addEventListener('click', () => helpSystem.show());
    btnLegend.addEventListener('click', () => legendManager.toggle());
    btnZoomIn.addEventListener('click', zoomIn);
    btnZoomOut.addEventListener('click', zoomOut);
    btnZoomReset.addEventListener('click', resetZoom);
    btnLoad.addEventListener('click', openFilePicker);
    btnSave.addEventListener('click', saveTopology);
    btnRunPf.addEventListener('click', runPf);
    btnRunOpt.addEventListener('click', runOptimization);

    // 添加工具提示
    btnLegend.setAttribute('data-tooltip', '查看节点类型说明和图例 (Ctrl+L)');
    btnZoomIn.setAttribute('data-tooltip', '放大画布 (Ctrl++)');
    btnZoomOut.setAttribute('data-tooltip', '缩小画布 (Ctrl+-)');
    btnZoomReset.setAttribute('data-tooltip', '重置缩放 (Ctrl+0)');
    btnLoad.setAttribute('data-tooltip', '从 JSON 文件导入网络拓扑 (Ctrl+O)');
    btnSave.setAttribute('data-tooltip', '将当前拓扑导出为 JSON 文件 (Ctrl+S)');
    btnRunPf.setAttribute('data-tooltip', '运行 AC 潮流计算 (Ctrl+R)');
    btnRunOpt.setAttribute('data-tooltip', '运行拓扑重构与 DG 优化');

    // 绑定图例高亮事件
    bindLegendEvents();

    // 绑定键盘快捷键
    bindKeyboardShortcuts();
  }

  // ==================== 图例高亮事件 ====================

  function bindLegendEvents() {
    document.addEventListener('legend-highlight', (e) => {
      const type = e.detail.type;
      highlightNodesByType(type);
    });
  }

  // ==================== 键盘快捷键绑定 ====================

  function bindKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // 防止在输入框中触发
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      // F1: 帮助
      if (e.key === 'F1') {
        e.preventDefault();
        helpSystem.show();
      }

      // Ctrl+N: 新建 (清空画布)
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        if (confirm('确定要清空当前画布吗？此操作不可撤销。')) {
          graph.clear();
        }
      }

      // Ctrl+Z: 撤销 (预留)
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        // TODO: 实现撤销功能
        console.log('撤销功能待实现');
      }

      // Ctrl+Y: 重做 (预留)
      if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        // TODO: 实现重做功能
        console.log('重做功能待实现');
      }

      // Ctrl+C: 复制 (预留)
      if (e.ctrlKey && e.key === 'c') {
        if (selectedElement) {
          e.preventDefault();
          // TODO: 实现复制功能
          console.log('复制功能待实现');
        }
      }

      // Ctrl+V: 粘贴 (预留)
      if (e.ctrlKey && e.key === 'v') {
        e.preventDefault();
        // TODO: 实现粘贴功能
        console.log('粘贴功能待实现');
      }

      // Ctrl++: 放大
      if (e.ctrlKey && (e.key === '+' || e.key === '=')) {
        e.preventDefault();
        zoomIn();
      }

      // Ctrl+-: 缩小
      if (e.ctrlKey && e.key === '-') {
        e.preventDefault();
        zoomOut();
      }

      // Ctrl+0: 重置缩放
      if (e.ctrlKey && e.key === '0') {
        e.preventDefault();
        resetZoom();
      }

      // Ctrl+L: 切换图例
      if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        legendManager.toggle();
      }

      // Ctrl+R: 运行潮流
      if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        runPf();
      }
    });
  }

  // ==================== 缩放控制 ====================

  function zoomIn() {
    const currentZoom = paper.scale().sx;
    const newZoom = Math.min(currentZoom * 1.1, 3);
    paper.scale(newZoom, newZoom);
  }

  function zoomOut() {
    const currentZoom = paper.scale().sx;
    const newZoom = Math.max(currentZoom / 1.1, 0.3);
    paper.scale(newZoom, newZoom);
  }

  function resetZoom() {
    paper.scale(1, 1);
    paper.translate(0, 0);
  }

  function highlightNodesByType(type) {
    // 清除之前的高亮
    clearAllHighlights();

    // 高亮指定类型的节点
    const elements = graph.getElements();
    elements.forEach(element => {
      if (element.get('type') === type) {
        const cellView = paper.findViewByModel(element);
        if (cellView) {
          cellView.el.classList.add('highlighted');
        }
      }
    });

    // 3秒后自动清除高亮
    setTimeout(() => {
      clearAllHighlights();
    }, 3000);
  }

  function clearAllHighlights() {
    const highlighted = paper.el.querySelectorAll('.highlighted');
    highlighted.forEach(el => {
      el.classList.remove('highlighted');
    });
  }

  function openFilePicker() {
    const input = document.getElementById('file-input');
    input.value = '';
    input.onchange = async (evt) => {
      const file = evt.target.files && evt.target.files[0];
      if (!file) return;
      const text = await file.text();
      try {
        const json = JSON.parse(text);
        importTopology(json);
      } catch (err) {
        alert(`无法解析文件: ${err.message}`);
      }
    };
    input.click();
  }

  function saveTopology() {
    const json = exportTopology();
    const data = JSON.stringify(json, null, 2);

    if (isElectron) {
      // Electron环境：使用文件保存对话框
      electronAPI.exportData(data).then((result) => {
        if (result.success) {
          console.log('文件已保存到:', result.filePath);
        } else {
          console.error('保存失败:', result.error);
        }
      });
    } else {
      // Web环境：使用浏览器下载
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${json.meta.feeder || 'topology'}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }

  // ==================== Julia桥接 ====================

  async function runPf() {
    const btn = document.getElementById('btn-run-pf');
    const topo = exportTopology();
    const result = validationManager.validate(topo);

    if (!result.isValid) {
      // 显示验证结果对话框
      validationDialog.show(result, (continueAnyway) => {
        if (continueAnyway) {
          executeRunPf(btn, topo);
        }
      });
    } else {
      // 直接执行
      executeRunPf(btn, topo);
    }
  }

  async function executeRunPf(btn, topo) {
    ButtonStateManager.setLoading(btn, true, '潮流计算中...');
    progressIndicator.show('AC 潮流计算', [
      { title: '数据验证', description: '检查网络拓扑参数' },
      { title: '拓扑转换', description: '转换内部数据格式' },
      { title: '潮流求解', description: '运行 AC 潮流算法' },
      { title: '结果处理', description: '处理和显示结果' }
    ]);

    try {
      // 模拟进度更新
      setTimeout(() => progressIndicator.updateProgress(25, '正在验证数据...'), 200);
      setTimeout(() => progressIndicator.completeStep(0), 500);
      setTimeout(() => progressIndicator.updateProgress(50, '正在转换拓扑...'), 800);
      setTimeout(() => progressIndicator.completeStep(1), 1200);
      setTimeout(() => progressIndicator.updateProgress(75, '正在求解...'), 1500);
      setTimeout(() => progressIndicator.completeStep(2), 2000);

      const payload = JSON.stringify(topo);
      const resp = await callJulia('run_pf', payload);

      progressIndicator.updateProgress(100, '计算完成');
      progressIndicator.completeStep(3);
      await new Promise(resolve => setTimeout(resolve, 500));
      progressIndicator.hide();

      updateResults(resp.data);
      appendHistory('AC 潮流', resp);
      ButtonStateManager.setSuccess(btn, '潮流完成');
    } catch (err) {
      progressIndicator.setError('计算失败');
      ButtonStateManager.setError(btn, '计算失败');
      setTimeout(() => {
        progressIndicator.hide();
        alert(err.message);
      }, 1500);
    } finally {
      ButtonStateManager.setLoading(btn, false);
    }
  }

  async function runOptimization() {
    const btn = document.getElementById('btn-run-optimization');
    const topo = exportTopology();
    const result = validationManager.validate(topo);

    if (!result.isValid) {
      // 显示验证结果对话框
      validationDialog.show(result, (continueAnyway) => {
        if (continueAnyway) {
          executeRunOptimization(btn, topo);
        }
      });
    } else {
      // 直接执行
      executeRunOptimization(btn, topo);
    }
  }

  async function executeRunOptimization(btn, topo) {
    ButtonStateManager.setLoading(btn, true, '优化计算中...');
    progressIndicator.show('拓扑重构与 DG 优化', [
      { title: '数据验证', description: '验证网络参数' },
      { title: '拓扑分析', description: '分析网络结构' },
      { title: 'DG 优化', description: '优化 DG 配置' },
      { title: '潮流计算', description: '计算优化后潮流' },
      { title: '结果分析', description: '分析优化结果' }
    ]);

    try {
      // 模拟进度更新
      setTimeout(() => progressIndicator.updateProgress(20, '正在验证...'), 200);
      setTimeout(() => progressIndicator.completeStep(0), 600);
      setTimeout(() => progressIndicator.updateProgress(40, '正在分析拓扑...'), 1000);
      setTimeout(() => progressIndicator.completeStep(1), 1500);
      setTimeout(() => progressIndicator.updateProgress(60, '正在优化 DG...'), 2200);
      setTimeout(() => progressIndicator.completeStep(2), 2800);
      setTimeout(() => progressIndicator.updateProgress(80, '正在计算潮流...'), 3500);
      setTimeout(() => progressIndicator.completeStep(3), 4200);
      setTimeout(() => progressIndicator.updateProgress(95, '正在分析结果...'), 5000);
      setTimeout(() => progressIndicator.completeStep(4), 5800);

      const payload = JSON.stringify(topo);
      const resp = await callJulia('run_reconfiguration', payload);

      progressIndicator.updateProgress(100, '优化完成');
      await new Promise(resolve => setTimeout(resolve, 500));
      progressIndicator.hide();

      updateResults(resp.data?.pf || resp.data);
      appendHistory('拓扑重构 + DG', resp);
      ButtonStateManager.setSuccess(btn, '优化完成');
    } catch (err) {
      progressIndicator.setError('优化失败');
      ButtonStateManager.setError(btn, '优化失败');
      setTimeout(() => {
        progressIndicator.hide();
        alert(err.message);
      }, 1500);
    } finally {
      ButtonStateManager.setLoading(btn, false);
    }
  }

  async function callJulia(fnName, jsonString) {
    if (!window.Julia || typeof window.Julia.call !== 'function') {
      throw new Error('Julia 桥接尚未就绪');
    }
    const raw = await window.Julia.call(fnName, jsonString);
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (obj.status !== 'ok') {
      throw new Error(obj.message || 'Julia 返回错误');
    }
    return obj;
  }

  function updateResults(data) {
    if (!data) return;
    const results = document.getElementById('results');
    const buses = data.buses?.map((bus) => `<tr><td>${bus.id}</td><td>${bus.vm_pu?.toFixed(4)}</td><td>${bus.va_deg?.toFixed(2)}</td></tr>`).join('') || '';
    const branches = data.branches?.map((branch) => `<tr><td>${branch.id}</td><td>${branch.p_mw?.toFixed(4)}</td><td>${branch.loading_pct?.toFixed(2)}%</td></tr>`).join('') || '';
    results.innerHTML = `
      <section>
        <h3>节点电压</h3>
        <table><thead><tr><th>ID</th><th>Vm (p.u.)</th><th>Va (°)</th></tr></thead><tbody>${buses}</tbody></table>
      </section>
      <section>
        <h3>支路潮流</h3>
        <table><thead><tr><th>ID</th><th>P (MW)</th><th>载荷 (%)</th></tr></thead><tbody>${branches}</tbody></table>
      </section>
      <section>
        <h3>汇总</h3>
        <pre>${JSON.stringify(data.summary || {}, null, 2)}</pre>
      </section>
    `;
  }

  function appendHistory(label, response) {
    const list = document.getElementById('run-history');
    const item = document.createElement('li');
    const stamp = new Date().toLocaleString();
    item.innerHTML = `<strong>${label}</strong><br /><small>${stamp}</small><pre>${JSON.stringify(response.data.summary || {}, null, 2)}</pre>`;
    list.prepend(item);
  }

  // ==================== 拓扑校验 ====================

  function validateTopology(topo) {
    const errors = [];
    const baseMVA = Number(topo.meta?.baseMVA);
    if (!Number.isFinite(baseMVA) || baseMVA <= 0) {
      errors.push('meta.baseMVA 需设置为正数');
    }
    const busIds = new Set(
      (topo.nodes || [])
        .filter((node) => String(node.type || node.category).toLowerCase() === 'bus')
        .map((node) => node.id)
    );
    if (!busIds.size) {
      errors.push('至少需要一个母线节点');
    }
    return errors;
  }

  function formatValidationErrors(errors) {
    return errors.map((err, idx) => `${idx + 1}. ${err}`).join('\n');
  }

  // ==================== 本地存储 ====================

  function persistToLocalStorage() {
    const json = exportTopology();
    localStorage.setItem('jgdo-topology', JSON.stringify(json));
  }

  function restoreFromLocalStorage() {
    const stored = localStorage.getItem('jgdo-topology');
    if (stored) {
      try {
        importTopology(JSON.parse(stored));
      } catch (err) {
        console.warn('failed to restore diagram', err);
      }
    }
  }

  graph.on('add remove change', persistToLocalStorage);

  // ==================== 初始化 ====================

  function init() {
    renderPalette();
    bindUiEvents();
    restoreFromLocalStorage();
    console.log('JointJS Canvas initialized');
  }

  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 导出全局对象
  window.jointCanvas = {
    graph,
    paper,
    addNode: addNodeToCanvas,
    exportTopology,
    importTopology,
    jumpToError: function(errorIndex) {
      // 根据错误索引跳转到对应位置
      console.log('跳转到错误:', errorIndex);
      // TODO: 实现错误位置跳转逻辑
    }
  };
})();
