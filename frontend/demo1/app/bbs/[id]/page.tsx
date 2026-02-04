"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, MessageCircle, Clock, Eye, ThumbsUp, Flag, Reply, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { use } from "react";

const threadData = {
  id: 1,
  title: "新宿エリアでおすすめの店舗を教えてください",
  category: "question",
  author: "名無しさん",
  createdAt: "2024年1月15日 14:30",
  content: "来週初めて新宿のメンズエステに行こうと思っています。\n清潔感があって、初心者にも優しいお店を探しています。\n予算は60分15000円くらいで考えています。\n\nおすすめの店舗があれば教えていただけると嬉しいです。",
  replyCount: 24,
  viewCount: 312,
};

const replies = [
  {
    id: 1,
    author: "経験者A",
    createdAt: "2024年1月15日 15:00",
    content: "新宿なら〇〇がおすすめですよ。スタッフの対応も丁寧で、初心者の方にも分かりやすく説明してくれます。",
    likes: 12,
    isOP: false,
  },
  {
    id: 2,
    author: "名無しさん",
    createdAt: "2024年1月15日 15:30",
    content: "ありがとうございます！調べてみます。",
    likes: 2,
    isOP: true,
  },
  {
    id: 3,
    author: "レビュアーB",
    createdAt: "2024年1月15日 16:15",
    content: "△△も良いと思います。予約が取りやすいのもポイント高いです。セラピストさんの質も安定してます。",
    likes: 8,
    isOP: false,
  },
  {
    id: 4,
    author: "情報通C",
    createdAt: "2024年1月15日 17:00",
    content: "初めてならWebサイトの情報が充実しているところを選ぶと安心ですよ。料金体系が明確なお店がおすすめです。",
    likes: 15,
    isOP: false,
  },
  {
    id: 5,
    author: "名無しさん",
    createdAt: "2024年1月15日 17:30",
    content: "皆さんありがとうございます！参考にさせていただきます。また行ったら報告しますね。",
    likes: 5,
    isOP: true,
  },
];

export default function BBSThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [replyContent, setReplyContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitReply = async () => {
    if (!replyContent.trim()) return;
    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSubmitting(false);
    setReplyContent("");
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="container mx-auto px-4 py-6">
        <div className="max-w-4xl mx-auto">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
            <Link href="/" className="hover:text-foreground transition-colors">ホーム</Link>
            <ChevronRight className="h-4 w-4" />
            <Link href="/bbs" className="hover:text-foreground transition-colors">掲示板</Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground truncate max-w-[200px]">{threadData.title}</span>
          </nav>

          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline">質問</Badge>
              </div>
              <CardTitle className="text-xl">{threadData.title}</CardTitle>
              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                <span>{threadData.author}</span>
                <span>{threadData.createdAt}</span>
                <span className="flex items-center gap-1">
                  <MessageCircle className="h-4 w-4" />
                  {threadData.replyCount}
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="h-4 w-4" />
                  {threadData.viewCount}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{threadData.content}</p>
            </CardContent>
          </Card>

          <div className="mb-6">
            <h2 className="text-lg font-bold mb-4">返信 ({replies.length}件)</h2>
            <div className="space-y-4">
              {replies.map((reply, index) => (
                <Card key={reply.id} className={reply.isOP ? "border-primary/30 bg-primary/5" : ""}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="text-sm bg-muted">
                          {reply.author.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-medium">{reply.author}</span>
                          {reply.isOP && (
                            <Badge variant="secondary" className="text-xs">スレ主</Badge>
                          )}
                          <span className="text-xs text-muted-foreground">{reply.createdAt}</span>
                          <span className="text-xs text-muted-foreground">#{index + 1}</span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap mb-3">{reply.content}</p>
                        <div className="flex items-center gap-4">
                          <Button variant="ghost" size="sm" className="h-8 gap-1 text-muted-foreground">
                            <ThumbsUp className="h-4 w-4" />
                            <span>{reply.likes}</span>
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 gap-1 text-muted-foreground">
                            <Reply className="h-4 w-4" />
                            返信
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 gap-1 text-muted-foreground">
                            <Flag className="h-4 w-4" />
                            報告
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">返信を投稿</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="返信内容を入力してください..."
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                rows={4}
                className="mb-4"
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  投稿は利用規約に同意したものとみなされます
                </p>
                <Button onClick={handleSubmitReply} disabled={!replyContent.trim() || isSubmitting} className="gap-2">
                  <Send className="h-4 w-4" />
                  {isSubmitting ? "投稿中..." : "投稿する"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
