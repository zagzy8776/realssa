import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, MessageCircle, Share2, Heart } from "lucide-react";
import { NewsItem } from "@/data/newsData";

interface RSSArticlePreviewProps {
  article: NewsItem;
  onComment?: () => void;
  onShare?: () => void;
}

const RSSArticlePreview = ({ article, onComment, onShare }: RSSArticlePreviewProps) => {
  const [showFullPreview, setShowFullPreview] = useState(false);

  const handleExternalLink = () => {
    if (article.externalLink) {
      window.open(article.externalLink, '_blank', 'noopener,noreferrer');
    }
  };

  const handleCommentClick = () => {
    if (onComment) {
      onComment();
    }
  };

  const handleShareClick = () => {
    if (onShare) {
      onShare();
    }
  };

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold">{article.title}</CardTitle>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>{article.date}</span>
              <span>•</span>
              <span>{article.readTime}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleCommentClick}
              className="flex items-center gap-2"
            >
              <MessageCircle className="h-4 w-4" />
            Discuss
            </Button>
            <Button
              variant="outline"
              onClick={handleShareClick}
              className="flex items-center gap-2"
            >
              <Share2 className="h-4 w-4" />
              Share
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Featured Image */}
        <div className="relative">
          <img
            src={article.image}
            alt={article.title}
            className="w-full h-64 object-cover rounded-lg"
          />
          <div className="absolute top-4 left-4">
            <span className="bg-primary/20 text-primary px-3 py-1 rounded-full text-sm font-medium">
              RSS Article
            </span>
          </div>
        </div>

        {/* Excerpt */}
        <div className="prose max-w-none">
          <p className="text-lg leading-relaxed">{article.excerpt}</p>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-4">
          <Button
            onClick={handleExternalLink}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90"
          >
            <ExternalLink className="h-4 w-4" />
            Read Full Article on Source
          </Button>
          
          <Button
            variant="outline"
            onClick={() => setShowFullPreview(!showFullPreview)}
            className="flex items-center gap-2"
          >
            {showFullPreview ? 'Hide' : 'Show'} Preview
          </Button>
        </div>

        {/* Full Preview */}
        {showFullPreview && (
          <div className="p-4 bg-muted/50 rounded-lg">
            <h4 className="font-semibold mb-2">Full Article Preview</h4>
            <p className="text-sm text-muted-foreground">
              This is a preview of the full article content. The complete article is available on the original source website.
            </p>
            <div className="mt-4 space-y-2">
              <p className="text-sm">{article.excerpt}</p>
              <p className="text-sm text-muted-foreground">
                Note: This content is automatically fetched from RSS feeds and may not be complete. 
                For the full article, please visit the original source.
              </p>
            </div>
          </div>
        )}

        {/* Community Section */}
        <div className="border-t pt-6">
          <h4 className="font-semibold mb-4">Join the Discussion</h4>
          <p className="text-sm text-muted-foreground mb-4">
            What do you think about this article? Share your thoughts and join the conversation below.
          </p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleCommentClick}
              className="flex items-center gap-2"
            >
              <MessageCircle className="h-4 w-4" />
              Add Comment
            </Button>
            <Button
              variant="outline"
              onClick={handleShareClick}
              className="flex items-center gap-2"
            >
              <Share2 className="h-4 w-4" />
              Share with Friends
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default RSSArticlePreview;