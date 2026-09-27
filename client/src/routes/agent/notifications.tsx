import { createFileRoute, Link } from "@tanstack/react-router";
import { AgentPageLayout } from "@/components/layout/AgentPageLayout";
import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  CheckCheck,
  Loader2,
  MessageSquare,
  CreditCard,
  FileText,
  Info,
  ChevronRight,
} from "lucide-react";

export const Route = createFileRoute("/agent/notifications")({
  component: NotificationsPage,
});

const typeIcons: Record<string, any> = {
  status_change: ChevronRight,
  quotation: MessageSquare,
  payment: CreditCard,
  document: FileText,
  info: Info,
};

function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const res = await apiClient.get<any>("/api/agent-requests/notifications/list");
      if (res.success) {
        setNotifications(res.data.notifications);
        setUnreadCount(res.data.unreadCount);
      }
    } catch {}
    finally { setLoading(false); }
  };

  const markAllAsRead = async () => {
    try {
      await apiClient.post<any>("/api/agent-requests/notifications/read", { all: true });
      setNotifications(notifications.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {}
  };

  const markAsRead = async (id: number) => {
    try {
      await apiClient.post<any>("/api/agent-requests/notifications/read", { id });
      setNotifications(notifications.map(n => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount(Math.max(0, unreadCount - 1));
    } catch {}
  };

  const formatDate = (dateStr: string) => {
    const now = new Date();
    const d = new Date(dateStr);
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Baru saja";
    if (minutes < 60) return `${minutes} menit lalu`;
    if (hours < 24) return `${hours} jam lalu`;
    if (days < 7) return `${days} hari lalu`;
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  };

  return (
    <AgentPageLayout
      title="Notifikasi"
      subtitle={`${unreadCount} belum dibaca`}
      actions={
        unreadCount > 0 ? (
          <Button size="sm" variant="outline" onClick={markAllAsRead} className="h-9 px-3 text-xs font-semibold border-[#e5e7eb] rounded-md">
            <CheckCheck className="h-3.5 w-3.5 mr-1.5" />
            Tandai Semua Dibaca
          </Button>
        ) : undefined
      }
    >
      <div className="max-w-3xl space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : notifications.length === 0 ? (
          <Card className="p-12 border border-[#e5e7eb] rounded-lg shadow-none text-center">
            <Bell className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-sm font-medium text-gray-500">Belum ada notifikasi</p>
            <p className="text-xs text-gray-400 mt-1">Notifikasi akan muncul saat ada update pada request Anda</p>
          </Card>
        ) : (
          notifications.map((notif) => {
            const Icon = typeIcons[notif.type] || Info;
            return (
              <Card
                key={notif.id}
                className={`p-4 border rounded-lg shadow-none transition-colors cursor-pointer ${
                  notif.isRead ? "border-[#e5e7eb] bg-white" : "border-[#111111]/10 bg-[#f8f9fa]"
                }`}
                onClick={() => {
                  if (!notif.isRead) markAsRead(notif.id);
                }}
              >
                <div className="flex items-start gap-3">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                    notif.isRead ? "bg-[#f5f5f5] text-gray-400" : "bg-[#111111] text-white"
                  }`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`text-xs font-semibold ${notif.isRead ? "text-gray-600" : "text-[#111111]"}`}>
                        {notif.title}
                      </p>
                      {!notif.isRead && (
                        <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">{notif.message}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{formatDate(notif.createdAt)}</p>
                  </div>
                  {notif.requestId && (
                    <Link
                      to="/agent/request/$requestId"
                      params={{ requestId: notif.requestId.toString() }}
                      className="text-[10px] font-medium text-gray-400 hover:text-[#111111] transition-colors shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Lihat →
                    </Link>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>
    </AgentPageLayout>
  );
}
