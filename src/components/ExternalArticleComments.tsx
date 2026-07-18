import { apiUrl } from '@/lib/api-base';
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, Send, Heart, User, Reply, X } from "lucide-react";

interface Comment {
  id: string;
  articleId: string;
  parentId?: string | null;
  author: string;
  content: string;
  date: string;
  likes: number;
  replies?: Comment[];
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

  // Threaded reply states
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [replyAuthor, setReplyAuthor] = useState('');

  // Fetch comments for this article
  const fetchComments = async () => {
    try {
      setLoading(true);
      const response = await fetch(apiUrl(`/api/comments?articleId=${articleId}`));
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

  useEffect(() => {
    fetchComments();
  }, [articleId]);

  const handleSubmitComment = async (e: React.FormEvent, parentId: string | null = null) => {
    e.preventDefault();
    const author = parentId ? replyAuthor : commentAuthor;
    const content = parentId ? replyContent : newComment;

    if (!content.trim() || !author.trim()) return;

    setSubmittingComment(true);
    try {
      const response = await fetch(apiUrl('/api/comments'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          articleId: articleId,
          author: author.trim(),
          content: content.trim(),
          parentId: parentId,
        }),
      });

      if (response.ok) {
        // Reload all comments from database to fetch updated tree layout
        await fetchComments();
        
        if (parentId) {
          setReplyContent('');
          setReplyAuthor('');
          setReplyingToId(null);
        } else {
          setNewComment('');
          setCommentAuthor('');
        }
        
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
      const response = await fetch(apiUrl(`/api/comments/${commentId}/like`), {
        method: 'POST',
      });

      if (response.ok) {
        const updatedComment = await response.json();
        
        // Search and update comments tree locally
        const updateLikesInTree = (list: Comment[]): Comment[] => {
          return list.map(c => {
            if (c.id === commentId) {
              return { ...c, likes: updatedComment.likes };
            }
            if (c.replies && c.replies.length > 0) {
              return { ...c, replies: updateLikesInTree(c.replies) };
            }
            return c;
          });
        };
        
        setComments(prev => updateLikesInTree(prev));
      }
    } catch (err) {
      console.error('Error liking comment:', err);
    }
  };

  // Helper to count total comments in tree
  const getCommentsCount = (list: Comment[]): number => {
    let count = list.length;
    list.forEach(c => {
      if (c.replies) {
        count += getCommentsCount(c.replies);
      }
    });
    return count;
  };

  const renderCommentNode = (comment: Comment, isReplyNode = false) => {
    return (
      <div key={comment.id} className="space-y-3">
        <div className={`border border-border rounded-xl p-4 bg-card/50 hover:bg-card/70 transition-colors ${isReplyNode ? 'bg-muted/30 hover:bg-muted/50 border-dashed' : ''}`}>
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">{comment.author}</p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(comment.date).toLocaleDateString()} at {new Date(comment.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              {/* Like Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleLikeComment(comment.id)}
                className="h-8 flex items-center gap-1 text-muted-foreground hover:text-red-500 hover:bg-transparent"
              >
                <Heart className="h-4 w-4" />
                <span className="text-xs">{comment.likes || 0}</span>
              </Button>

              {/* Reply trigger (Only allow replying to parent threads, i.e., max 2 levels) */}
              {!isReplyNode && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setReplyingToId(comment.id);
                    setReplyContent('');
                    setReplyAuthor('');
                  }}
                  className="h-8 flex items-center gap-1 text-muted-foreground hover:text-primary hover:bg-transparent"
                >
                  <Reply className="h-4 w-4" />
                  <span className="text-xs">Reply</span>
                </Button>
              )}
            </div>
          </div>
          <p className="text-sm leading-relaxed text-foreground/90 pl-1">{comment.content}</p>

          {/* Inline Reply Form */}
          {replyingToId === comment.id && (
            <form onSubmit={(e) => handleSubmitComment(e, comment.id)} className="mt-4 border-t border-border/80 pt-3 space-y-3 animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                  <Reply className="w-3.5 h-3.5" /> Replying to {comment.author}
                </span>
                <button
                  type="button"
                  onClick={() => setReplyingToId(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <Input
                  placeholder="Your Name"
                  size={30}
                  value={replyAuthor}
                  onChange={(e) => setReplyAuthor(e.target.value)}
                  className="h-9 text-xs"
                  required
                />
              </div>
              <Textarea
                placeholder="Write your response..."
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                rows={2}
                className="text-xs"
                required
              />
              <div className="flex gap-2">
                <Button
                  type="submit"
                  size="sm"
                  disabled={submittingComment || !replyContent.trim() || !replyAuthor.trim()}
                  className="text-xs h-8"
                >
                  Post Reply
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setReplyingToId(null)}
                  className="text-xs h-8"
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>

        {/* Render child comments recursively (indented) */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="ml-8 md:ml-12 border-l border-border/60 pl-4 space-y-3">
            {comment.replies.map(reply => renderCommentNode(reply, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center gap-3">
          <MessageCircle className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Community Discussion</CardTitle>
          <span className="text-sm text-muted-foreground">({getCommentsCount(comments)})</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Join the conversation about "{articleTitle}"
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Comment Form */}
        <form onSubmit={(e) => handleSubmitComment(e)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              placeholder="Your name"
              value={commentAuthor}
              onChange={(e) => setCommentAuthor(e.target.value)}
              required
            />
            <div className="text-xs text-muted-foreground flex items-center">
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
            comments.map((comment) => renderCommentNode(comment))
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
