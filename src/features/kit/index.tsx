import { useState } from 'react';
import Button from '../../components/ui/Button';
import Chip from '../../components/ui/Chip';
import Input from '../../components/ui/Input';
import Panel from '../../components/ui/Panel';
import Segmented from '../../components/ui/Segmented';
import Switch from '../../components/ui/Switch';

/**
 * 组件库页（M1 产出）。
 * **不是一级入口** —— 侧栏固定 5 项不得增删（§1.3），这里用 hash `#kit` 直达。
 */
export default function KitPage() {
  const [chip, setChip] = useState('all');
  const [seg, setSeg] = useState<'list' | 'graph'>('list');
  const [on, setOn] = useState(true);

  return (
    <div className="flex flex-col gap-5">
      <Panel title="Button" desc="状态语义色走三色：主色 = 行动 · 点缀色 = 需注意 · 墨灰 = 中性（D19）">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary">主行动</Button>
          <Button variant="secondary">次行动</Button>
          <Button variant="ghost">幽灵</Button>
          <Button variant="attention">需注意</Button>
          <Button variant="secondary" disabled>
            已禁用
          </Button>
          <Button variant="primary" size="sm">
            小号
          </Button>
        </div>
      </Panel>

      <Panel title="Chip" desc="筛选胶囊是「视图切换器」，不是过滤器（D12）">
        <div className="flex flex-wrap items-center gap-2">
          <Chip active={chip === 'all'} count={128} onClick={() => setChip('all')}>
            全部
          </Chip>
          <Chip active={chip === 'notes'} count={64} onClick={() => setChip('notes')}>
            笔记
          </Chip>
          <Chip active={chip === 'know'} count={56} onClick={() => setChip('know')}>
            知识点
          </Chip>
        </div>
        <p className="mt-3 font-mono text-[11px] text-ink-3">
          当前视图：{chip} · 注：「全部」只数文件素材，= 各文件夹之和（D31）
        </p>
      </Panel>

      <Panel title="Input" desc="密钥类输入单向：可写不可读（ADR-0003 硬约束 1）">
        <div className="flex max-w-[420px] flex-col gap-2.5">
          <Input placeholder="普通输入" />
          <Input secret placeholder="sk-ant-••••3f2a" defaultValue="secret-value" />
          <Input placeholder="已禁用" disabled />
        </div>
      </Panel>

      <Panel title="Switch" desc="一级入口必须有解释，开关也一样（原则 2）">
        <div className="flex flex-col gap-3">
          <Switch
            checked={on}
            onChange={setOn}
            label="为这个知识空间绑定独立 profile"
            desc="开启后该空间拥有独立的运行记忆与用户技能；代价是切换空间要冷启动（ADR-0006）"
          />
          <Switch
            checked={false}
            onChange={() => undefined}
            label="已禁用的开关"
            desc="disabled 态不参与键盘焦点"
            disabled
          />
        </div>
      </Panel>

      <Panel title="Segmented" desc="同一位置的视图二选一。列表 / 关联图（§5.2）">
        <Segmented
          ariaLabel="视图切换"
          value={seg}
          onChange={setSeg}
          options={[
            { value: 'list', label: '列表' },
            { value: 'graph', label: '关联图' },
          ]}
        />
      </Panel>
    </div>
  );
}
