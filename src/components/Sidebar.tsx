import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, FileText, Settings, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export const Sidebar = ({ isCollapsed, onToggle }: SidebarProps) => {
  const navigate = useNavigate();

  const menuItems = [
    {
      icon: Users,
      label: "Usuários",
      onClick: () => navigate('/users'),
    },
    {
      icon: FileText,
      label: "Logs",
      onClick: () => navigate('/logs'),
    },
    {
      icon: Settings,
      label: "Configuração",
      onClick: () => navigate('/config'),
    },
  ];

  return (
    <div className={`bg-blue-900 text-white transition-all duration-300 ${
      isCollapsed ? 'w-16' : 'w-64'
    } min-h-screen flex flex-col`}>
      {/* Logo Section */}
      <div className="p-4 border-b border-blue-800">
        <Logo isCollapsed={isCollapsed} />
      </div>

      {/* Toggle Button */}
      <div className="px-2 py-2 border-b border-blue-800">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="w-full text-white hover:bg-blue-800 justify-center"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </Button>
      </div>

      {/* Menu Items */}
      <nav className="flex-1 p-2">
        <ul className="space-y-2">
          {menuItems.map((item, index) => (
            <li key={index}>
              <Button
                variant="ghost"
                className={`w-full text-white hover:bg-blue-800 ${
                  isCollapsed ? 'justify-center px-2' : 'justify-start px-3'
                }`}
                onClick={item.onClick}
              >
                <item.icon className="w-5 h-5" />
                {!isCollapsed && <span className="ml-3">{item.label}</span>}
              </Button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      {!isCollapsed && (
        <div className="p-4 border-t border-blue-800">
          <p className="text-xs text-blue-300 text-center">
            Cassandra Query Pilot v1.0
          </p>
        </div>
      )}
    </div>
  );
}; 