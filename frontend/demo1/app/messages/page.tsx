"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Send, ArrowLeft, MessageCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { useAuth } from "@/lib/auth-context";
import { createSupabaseBrowser } from "@/lib/supabase/client";

interface Conversation {
  id: number;
  user1_id: string;
  user2_id: string;
  last_message_at: string | null;
  partner_nickname: string;
  last_message?: string;
  unread_count: number;
}

interface Message {
  id: number;
  sender_id: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return `${diff}秒前`;
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
  return `${Math.floor(diff / 86400)}日前`;
}

export default function MessagesPage() {
  const { user: authUser } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 会話一覧取得
  useEffect(() => {
    if (!authUser) { setLoading(false); return; }
    const supabase = createSupabaseBrowser();

    async function fetchConversations() {
      const { data } = await supabase
        .from("conversations")
        .select("id, user1_id, user2_id, last_message_at")
        .or(`user1_id.eq.${authUser!.id},user2_id.eq.${authUser!.id}`)
        .order("last_message_at", { ascending: false, nullsFirst: false });

      if (!data || data.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      // パートナーのニックネームを取得
      const partnerIds = data.map((c) =>
        c.user1_id === authUser!.id ? c.user2_id : c.user1_id
      );
      const uniquePartnerIds = [...new Set(partnerIds)];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nickname")
        .in("id", uniquePartnerIds);

      const profileMap = new Map(
        (profiles || []).map((p) => [p.id, p.nickname || "名無しさん"])
      );

      // 最新メッセージ取得
      const convIds = data.map((c) => c.id);
      const { data: latestMessages } = await supabase
        .from("messages")
        .select("conversation_id, body, is_read, sender_id")
        .in("conversation_id", convIds)
        .order("created_at", { ascending: false });

      // 会話ごとの最新メッセージと未読数
      const lastMsgMap = new Map<number, string>();
      const unreadMap = new Map<number, number>();
      if (latestMessages) {
        const seen = new Set<number>();
        for (const m of latestMessages) {
          if (!seen.has(m.conversation_id)) {
            lastMsgMap.set(m.conversation_id, m.body);
            seen.add(m.conversation_id);
          }
          if (!m.is_read && m.sender_id !== authUser!.id) {
            unreadMap.set(m.conversation_id, (unreadMap.get(m.conversation_id) || 0) + 1);
          }
        }
      }

      setConversations(
        data.map((c) => {
          const partnerId = c.user1_id === authUser!.id ? c.user2_id : c.user1_id;
          return {
            ...c,
            partner_nickname: profileMap.get(partnerId) || "名無しさん",
            last_message: lastMsgMap.get(c.id),
            unread_count: unreadMap.get(c.id) || 0,
          };
        })
      );
      setLoading(false);
    }

    fetchConversations();
  }, [authUser]);

  // メッセージ取得
  useEffect(() => {
    if (!selectedConvId || !authUser) return;
    const supabase = createSupabaseBrowser();

    supabase
      .from("messages")
      .select("id, sender_id, body, is_read, created_at")
      .eq("conversation_id", selectedConvId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        setMessages((data as Message[]) || []);
        // 未読を既読に
        supabase
          .from("messages")
          .update({ is_read: true })
          .eq("conversation_id", selectedConvId)
          .neq("sender_id", authUser.id)
          .eq("is_read", false)
          .then(() => {});
      });
  }, [selectedConvId, authUser]);

  // メッセージスクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !authUser || !selectedConvId) return;
    setSending(true);
    const supabase = createSupabaseBrowser();
    const { data, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: selectedConvId,
        sender_id: authUser.id,
        body: newMessage.trim(),
      })
      .select("id, sender_id, body, is_read, created_at")
      .single();

    if (!error && data) {
      setMessages((prev) => [...prev, data as Message]);
      setNewMessage("");
      // last_message_at更新
      await supabase
        .from("conversations")
        .update({ last_message_at: data.created_at })
        .eq("id", selectedConvId);
    }
    setSending(false);
  };

  if (!authUser) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="container mx-auto px-4 py-12 text-center">
          <MessageCircle className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">メッセージを利用するにはログインが必要です</p>
          <Link href="/login"><Button>ログイン</Button></Link>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const selectedConv = conversations.find((c) => c.id === selectedConvId);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="container mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">メッセージ</h1>

        <div className="flex gap-6 h-[600px]">
          {/* 会話リスト */}
          <Card className={`w-80 flex-shrink-0 overflow-hidden ${selectedConvId ? "hidden md:flex" : "flex"} flex-col`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">会話一覧</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-0">
              {loading ? (
                <div className="p-4 space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse h-16 bg-muted rounded mx-4" />
                  ))}
                </div>
              ) : conversations.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <MessageCircle className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">まだメッセージはありません</p>
                </div>
              ) : (
                conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConvId(conv.id)}
                    className={`w-full flex items-center gap-3 p-4 text-left border-b transition-colors ${
                      selectedConvId === conv.id ? "bg-primary/10" : "hover:bg-muted"
                    }`}
                  >
                    <Avatar>
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {conv.partner_nickname[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm truncate">{conv.partner_nickname}</span>
                        {conv.last_message_at && (
                          <span className="text-xs text-muted-foreground">{timeAgo(conv.last_message_at)}</span>
                        )}
                      </div>
                      {conv.last_message && (
                        <p className="text-xs text-muted-foreground truncate">{conv.last_message}</p>
                      )}
                    </div>
                    {conv.unread_count > 0 && (
                      <span className="bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {conv.unread_count}
                      </span>
                    )}
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          {/* メッセージエリア */}
          <Card className={`flex-1 overflow-hidden ${!selectedConvId ? "hidden md:flex" : "flex"} flex-col`}>
            {selectedConvId && selectedConv ? (
              <>
                <CardHeader className="pb-3 border-b flex-row items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden"
                    onClick={() => setSelectedConvId(null)}
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <Avatar>
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {selectedConv.partner_nickname[0]}
                    </AvatarFallback>
                  </Avatar>
                  <CardTitle className="text-base">{selectedConv.partner_nickname}</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.map((msg) => {
                    const isMine = msg.sender_id === authUser.id;
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-lg px-4 py-2 ${
                            isMine
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                          <p className={`text-xs mt-1 ${isMine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                            {new Date(msg.created_at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </CardContent>
                <div className="p-4 border-t flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="メッセージを入力..."
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  />
                  <Button onClick={handleSend} disabled={sending || !newMessage.trim()} size="icon">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <MessageCircle className="h-12 w-12 mx-auto mb-3" />
                  <p>会話を選択してください</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
