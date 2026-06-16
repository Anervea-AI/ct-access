import { NavLink } from "react-router-dom";
import { NAV } from "./nav";
import { cn } from "@/design/primitives";
import { useUi } from "@/state/ui";
import { ChevronsLeft, PanelLeftIcon } from "@/design/icons";

export function Sidebar() {
  const collapsed = useUi((s) => s.sidebarCollapsed);
  const toggle = useUi((s) => s.toggleSidebar);

  return (
    <nav
      className={cn(
        "shrink-0 bg-panel border-r border-border flex flex-col py-3 overflow-y-auto transition-[width] duration-200",
        collapsed ? "w-14" : "w-56",
      )}
    >
      <div
        className={cn(
          "flex items-center pb-2",
          collapsed ? "justify-center px-0" : "justify-between px-4",
        )}
      >
        {!collapsed && <span className="label-caps text-sidebar-text-faint">Modules</span>}
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand modules" : "Collapse modules"}
          className="rounded-md p-1 text-sidebar-text-faint hover:bg-hover hover:text-primary transition-colors"
        >
          {collapsed ? <PanelLeftIcon size={18} /> : <ChevronsLeft size={16} />}
        </button>
      </div>

      {NAV.map((item) => (
        <NavLink
          key={item.path}
          to={`/${item.path}`}
          title={collapsed ? item.label : undefined}
          className={({ isActive }) =>
            cn(
              "mx-2 my-0.5 rounded-md flex items-center text-sm transition-colors group",
              collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2",
              isActive
                ? "bg-surface text-primary font-semibold shadow-sm border-r-2 border-accent"
                : "text-sidebar-text-muted hover:bg-hover hover:text-primary",
            )
          }
        >
          {({ isActive }) => (
            <>
              <item.Icon
                size={18}
                className={isActive ? "text-accent" : "text-sidebar-text-faint group-hover:text-primary"}
              />
              {!collapsed && (
                <>
                  <span className="flex-1">{item.label}</span>
                  <span className="font-mono text-[10px] text-sidebar-text-faint">{item.code}</span>
                </>
              )}
            </>
          )}
        </NavLink>
      ))}

      {!collapsed && (
        <div className="mt-auto px-4 pt-3 text-[10px] text-sidebar-text-faint leading-relaxed">
          Phase-0 prototype · synthetic de-identified data · not for clinical use
        </div>
      )}
    </nav>
  );
}
