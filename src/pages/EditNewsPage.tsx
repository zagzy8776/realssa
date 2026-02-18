import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { ArrowLeft, Save } from "lucide-react";
import { NewsItem, CategoryType } from "@/data/newsData";

const EditNewsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [article, setArticle] = useState<NewsItem | null>(null);
  const [formData, setFormData] = useState<Omit<NewsItem, 'id' | 'date'>>({
    title: "",
    excerpt: "",
    category: "afrobeats",
    image: "",
    readTime: "5 min read",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [originalDate, setOriginalDate] = useState("");

  // Load article data on component mount
  useEffect(() => {
    const loadArticle = async () => {
      setIsLoading(true);

      try {
        // Check admin status first
        const isAdmin = localStorage.getItem("isAdmin") === "true";
        if (!isAdmin) {
          navigate("/admin-login");
          return;
        }

        // Try to fetch from backend API first
        let foundArticle = null;
        const token = localStorage.getItem("token");

        if (token) {
          try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/articles/${id}`, {
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            });

            if (response.ok) {
              foundArticle = await response.json();
            }
          } catch (apiError) {
            console.warn("API fetch failed:", apiError);
          }
        }

        // If not found in API, check localStorage
        if (!foundArticle) {
          const userNews = JSON.parse(localStorage.getItem('userNews') || '[]');
          foundArticle = userNews.find((item: NewsItem) => item.id === id || item.id.toString() === id);
        }

        if (foundArticle) {
          setArticle(foundArticle);
          setFormData({
            title: foundArticle.title,
            excerpt: foundArticle.excerpt,
            category: foundArticle.category,
            image: foundArticle.image,
            readTime: foundArticle.readTime,
          });
          setOriginalDate(foundArticle.date || new Date().toISOString());
        } else {
          toast({
            title: "Error",
            description: "Article not found",
            variant: "destructive",
          });
          navigate('/admin-dashboard');
        }
      } catch (error) {
        console.error("Failed to load article:", error);
        toast({
          title: "Error",
          description: "Failed to load article",
          variant: "destructive",
        });
        navigate('/admin-dashboard');
      } finally {
        setIsLoading(false);
      }
    };

    loadArticle();
  }, [id, navigate]);

  // Auto-calculate read time based on excerpt
  useEffect(() => {
    if (formData.excerpt) {
      const words = formData.excerpt.split(/\s+/).filter(w => w.length > 0).length;
      const minutes = Math.max(1, Math.ceil(words / 200));
      setFormData(prev => ({
        ...prev,
        readTime: `${minutes} min read${minutes > 1 ? 's' : ''}`
      }));
    }
  }, [formData.excerpt]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCategoryChange = (value: CategoryType) => {
    setFormData(prev => ({ ...prev, category: value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setFormData(prev => ({
          ...prev,
          image: event.target?.result as string
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Update article in localStorage
      const news = JSON.parse(localStorage.getItem('userNews') || '[]');
      const updatedNews = news.map((item: NewsItem) =>
        item.id === id ? {
          ...formData,
          id: item.id, // Keep original ID
          date: originalDate // Keep original date
        } : item
      );

      localStorage.setItem('userNews', JSON.stringify(updatedNews));

      toast({
        title: "Success!",
        description: "Article has been updated successfully",
        variant: "default",
      });

      // Redirect back to dashboard
      setTimeout(() => navigate('/admin-dashboard'), 2000);
    } catch (error) {
      console.error("Failed to update article:", error);
      toast({
        title: "Error",
        description: "Failed to update article. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Back button */}
        <div className="mb-6">
          <Button
            onClick={() => navigate('/admin-dashboard')}
            variant="outline"
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>

        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Edit Article</CardTitle>
            <p className="text-muted-foreground">Update your news article</p>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Title Field */}
              <div className="space-y-2">
                <label htmlFor="title" className="text-sm font-medium leading-none">
                  Article Title
                </label>
                <Input
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  required
                  placeholder="Enter a catchy title for your article"
                />
              </div>

              {/* Excerpt Field */}
              <div className="space-y-2">
                <label htmlFor="excerpt" className="text-sm font-medium leading-none">
                  Article Excerpt
                </label>
                <Textarea
                  id="excerpt"
                  name="excerpt"
                  value={formData.excerpt}
                  onChange={handleChange}
                  required
                  placeholder="Write a brief summary of your article (1-2 sentences)"
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  This will be shown on the article cards and search results.
                </p>
              </div>

              {/* Category Field */}
              <div className="space-y-2">
                <label htmlFor="category" className="text-sm font-medium leading-none">
                  Category
                </label>
                <Select onValueChange={handleCategoryChange} value={formData.category}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="afrobeats">Afrobeats</SelectItem>
                    <SelectItem value="nollywood">Nollywood</SelectItem>
                    <SelectItem value="culture">Culture</SelectItem>
                    <SelectItem value="fashion">Fashion</SelectItem>
                    <SelectItem value="tech">Tech</SelectItem>
                    <SelectItem value="music">Music</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Image Field */}
              <div className="space-y-2">
                <label htmlFor="image" className="text-sm font-medium leading-none">
                  Featured Image
                </label>
                <div className="flex items-center gap-4">
                  <Input
                    id="image"
                    name="image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="cursor-pointer"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const fileInput = document.getElementById('image') as HTMLInputElement;
                      if (fileInput) fileInput.click();
                    }}
                  >
                    Browse Files
                  </Button>
                </div>
                {formData.image && (
                  <div className="mt-2">
                    <p className="text-sm text-muted-foreground mb-2">Preview:</p>
                    <img
                      src={formData.image}
                      alt="Preview"
                      className="max-h-48 rounded-lg object-cover border"
                    />
                  </div>
                )}
              </div>

              {/* Read Time Field */}
              <div className="space-y-2">
                <label htmlFor="readTime" className="text-sm font-medium leading-none">
                  Estimated Read Time
                </label>
                <Input
                  id="readTime"
                  name="readTime"
                  value={formData.readTime}
                  onChange={handleChange}
                  placeholder="e.g., 5 min read"
                />
                <p className="text-xs text-muted-foreground">
                  Automatically calculated based on excerpt length (200 words per minute)
                </p>
              </div>

              {/* Article Metadata */}
              <div className="p-4 bg-card/50 rounded-lg border border-border">
                <h3 className="font-medium mb-2">Article Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Article ID</p>
                    <p className="font-mono">{id}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Original Post Date</p>
                    <p>{originalDate}</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-4">
                <Button
                  type="button"
                  onClick={() => navigate('/admin-dashboard')}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EditNewsPage;