import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, Send, Heart, User } from "lucide-react";

interface Comment {
  id: string;
  articleId: string;
  author: string;
  content: string;
  date: string;
  likes: number;
}

interface ExternalArticleCommentsProps {
  articleId: string;
  articleTitle: string;
  onCommentPosted?: () => void;
}

const ExternalArticleComments = ({ 
  articleId, 
  articleTitle, 
  onCommentPosted 
}: ExternalArticleCommentsProps) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentAuthor, setCommentAuthor] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch comments for this article
  useEffect(() => {
    const fetchComments = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/comments?articleId=${articleId}`);
        if (response.ok) {
          const commentsData = await response.json();
          setComments(commentsData);
        }
      } catch (err) {
        console.warn("Failed to fetch comments:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchComments();
  }, [articleId]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !commentAuthor.trim()) return;

    setSubmittingComment(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          articleId: articleId,
          author: commentAuthor.trim(),
          content: newComment.trim(),
        }),
      });

      if (response.ok) {
        const newCommentData = await response.json();
        setComments(prev => [newCommentData, ...prev]);
        setNewComment('');
        setCommentAuthor('');
        if (onCommentPosted) {
          onCommentPosted();
        }
      } else {
        console.error('Failed to submit comment');
      }
    } catch (err) {
      console.error('Error submitting comment:', err);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleLikeComment = async (commentId: string) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/comments/${commentId}/like`, {
        method: 'POST',
      });

      if (response.ok) {
        const updatedComment = await response.json();
        setComments(prev => prev.map(comment =>
          comment.id === commentId ? updatedComment : comment
        ));
      }
    } catch (err) {
      console.error('Error liking comment:', err);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center gap-3">
          <MessageCircle className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Community Discussion</CardTitle>
          <span className="text-sm text-muted-foreground">({comments.length})</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Join the conversation about "{articleTitle}"
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Comment Form */}
        <form onSubmit={handleSubmitComment} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              placeholder="Your name"
              value={commentAuthor}
              onChange={(e) => setCommentAuthor(e.target.value)}
              required
            />
            <div className="text-xs text-muted-foreground">
              Your name will be displayed with your comment
            </div>
          </div>
          
          <Textarea
            placeholder="Share your thoughts about this article..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            rows={4}
            required
          />
          
          <Button
            type="submit"
            disabled={submittingComment || !newComment.trim() || !commentAuthor.trim()}
            className="flex items-center gap-2"
          >
            {submittingComment ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Posting...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Post Comment
              </>
            )}
          </Button>
        </form>

        {/* Comments List */}
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border-2 border-dashed border-border rounded-lg">
              <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">No comments yet. Be the first to share your thoughts!</p>
              <p className="text-xs mt-2">Comments are moderated and may take a few minutes to appear.</p>
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="border border-border rounded-lg p-4 bg-card/50 hover:bg-card/70 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{comment.author}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(comment.date).toLocaleDateString()} at {new Date(comment.date).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleLikeComment(comment.id)}
                    className="flex items-center gap-1 text-muted-foreground hover:text-red-500"
                  >
                    <Heart className="h-4 w-4" />
                    <span className="text-xs">{comment.likes || 0}</span>
                  </Button>
                </div>
                <p className="text-sm leading-relaxed text-foreground">{comment.content}</p>
              </div>
            ))
          )}
        </div>

        {/* Community Guidelines */}
        <div className="border-t pt-4">
          <h4 className="font-semibold mb-2">Community Guidelines</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Be respectful and constructive</li>
            <li>• No spam or promotional content</li>
            <li>• Keep discussions relevant to the article</li>
            <li>• Report inappropriate content to moderators</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default ExternalArticleComments;