interface Tab<T extends string> {
  id: T;
  label: string;
}

interface ToolbarTabsProps<T extends string> {
  tabs: Tab<T>[];
  active: T;
  onChange: (id: T) => void;
  actions?: React.ReactNode;
}

export function ToolbarTabs<T extends string>({
  tabs,
  active,
  onChange,
  actions,
}: ToolbarTabsProps<T>) {
  return (
    <div className="flex h-10 items-center border-b border-[var(--border)] px-8">
      <div className="flex flex-1 items-center gap-5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`text-xs transition-colors ${
              active === tab.id
                ? "font-medium text-[var(--text)]"
                : "font-normal text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {actions && <div className="flex items-center gap-1">{actions}</div>}
    </div>
  );
}
