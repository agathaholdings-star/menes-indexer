import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4">
      <Search className="h-12 w-12 text-muted-foreground" />
      <h2 className="text-xl font-bold">ページが見つかりません</h2>
      <p className="text-sm text-muted-foreground">
        お探しのページは存在しないか、移動した可能性があります
      </p>
      <Button asChild variant="outline">
        <Link href="/">トップページへ戻る</Link>
      </Button>
    </div>
  );
}
