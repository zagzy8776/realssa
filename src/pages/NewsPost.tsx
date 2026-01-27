import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { CategoryType, NewsItem } from "@/data/newsData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";

const NewsPost = () => {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);

  // Check admin status on component mount
  useEffect(() => {
    const adminStatus = localStorage.getItem("isAdmin") === "true";
    if (!adminStatus) {
      // Redirect to admin login if not authenticated
      navigate("/admin-login");
    } else {
      setIsAdmin(true);
    }
  }, [navigate]);

  const [formData, setFormData] = useState<Omit<NewsItem, 'id' | 'date'>>({
    title: "",
    excerpt: "",
    category: "afrobeats",
    image: "",
    readTime: "5 min read",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoReadTime, setAutoReadTime] = useState("1 min read");

  // Calculate read time automatically based on excerpt
  useEffect(() => {
    if (formData.excerpt) {
      const words = formData.excerpt.split(/\s+/).filter(w => w.length > 0).length;
      const minutes = Math.max(1, Math.ceil(words / 200)); // 200 words per minute
      setAutoReadTime(`${minutes} min read${minutes > 1 ? 's' : ''}`);
    }
  }, [formData.excerpt]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCategoryChange = (value: CategoryType) => {
    setFormData(prev => ({ ...prev, category: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Simulate API call to submit news
      const newNewsItem: NewsItem = {
        ...formData,
        id: Date.now().toString(),
        date: new Date().toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }),
      };

      // In a real app, you would send this to your backend API
      // await api.post('/news', newNewsItem);

      // For demo purposes, we'll store in localStorage
      const existingNews = JSON.parse(localStorage.getItem('userNews') || '[]');
      localStorage.setItem('userNews', JSON.stringify([...existingNews, newNewsItem]));

      toast({
        title: "Success!",
        description: "Your news article has been posted successfully.",
        variant: "default",
      });

      // Redirect to homepage after submission
      setTimeout(() => navigate('/'), 2000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to post news article. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-12">
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Post News Article</CardTitle>
            <p className="text-muted-foreground">Share your entertainment news with the world</p>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="title" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
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

              <div className="space-y-2">
                <label htmlFor="excerpt" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
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
              </div>

              <div className="space-y-2">
                <label htmlFor="category" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
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

              <div className="space-y-2">
                <label htmlFor="image" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Featured Image
                </label>
                <div className="flex items-center gap-4">
                  <Input
                    id="image"
                    name="image"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
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
                    }}
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
                    <p className="text-sm text-muted-foreground">Preview:</p>
                    <img
                      src={formData.image}
                      alt="Preview"
                      className="mt-2 max-h-32 rounded-lg object-cover"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="readTime" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Estimated Read Time
                </label>
                <Input
                  id="readTime"
                  name="readTime"
                  value={formData.readTime}
                  onChange={handleChange}
                  placeholder="e.g., 5 min read"
                />
              </div>

              <div className="pt-4">
                <Button type="submit" disabled={isSubmitting} className="w-full">
                  {isSubmitting ? "Posting..." : "Post News Article"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Footer />
    </div>
  );
};

export default NewsPost;