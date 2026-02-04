"use client";

import { Textarea } from "@/components/ui/textarea";

interface Comments {
  firstImpression: string;
  serviceReview: string;
}

interface StepCommentProps {
  comments: Comments;
  onChange: (key: keyof Comments, value: string) => void;
}

export function StepComment({ comments, onChange }: StepCommentProps) {
  return (
    <div className="px-4 py-6">
      <h2 className="text-xl font-bold text-foreground mb-2">
        ひとこと体験談
      </h2>
      <p className="text-sm text-muted-foreground mb-6">
        簡潔に感想を教えてください
      </p>
      <div className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="firstImpression" className="block font-medium text-foreground">
            第一印象は？
            <span className="text-xs text-muted-foreground ml-2">
              (50文字以内)
            </span>
          </label>
          <Textarea
            id="firstImpression"
            value={comments.firstImpression}
            onChange={(e) => onChange("firstImpression", e.target.value)}
            placeholder="例: 笑顔が素敵で話しやすかった"
            maxLength={50}
            className="resize-none h-20"
          />
          <div className="text-right text-xs text-muted-foreground">
            {comments.firstImpression.length}/50
          </div>
        </div>
        <div className="space-y-2">
          <label htmlFor="serviceReview" className="block font-medium text-foreground">
            施術はどうだった？
            <span className="text-xs text-muted-foreground ml-2">
              (100文字以内)
            </span>
          </label>
          <Textarea
            id="serviceReview"
            value={comments.serviceReview}
            onChange={(e) => onChange("serviceReview", e.target.value)}
            placeholder="例: 技術が高く、とてもリラックスできました"
            maxLength={100}
            className="resize-none h-28"
          />
          <div className="text-right text-xs text-muted-foreground">
            {comments.serviceReview.length}/100
          </div>
        </div>
      </div>
    </div>
  );
}
