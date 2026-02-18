import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Edit2, Trash2, PlusCircle, LogOut, Search, Star, Eye, EyeOff } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import CategoryBadge from "@/components/CategoryBadge";
import { NewsItem } from "@/data/newsData";

const AdminDashboard = () => {
  const [articles, setArticles] = useState<NewsItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [contentTypeFilter, setContentTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [adminUsername, setAdminUsername] = useState("");
  const [brokenLinks, setBrokenLinks] = useState<string[]>([]);
  const [checkingLinks, setCheckingLinks] = useState(false);
  const navigate = useNavigate();

  // Check admin status and load articles
  useEffect(() => {
    const checkAdminAndLoadArticles = async () => {
      setIsLoading(true);

      // Check if user is admin and has token
      const isAdmin = localStorage.getItem("isAdmin") === "true";
      const token = localStorage.getItem("token");

      if (!isAdmin || !token) {
        navigate("/admin-login");
        return;
      }

      // Get admin username
      const username = localStorage.getItem("adminUsername") || "Admin";
      setAdminUsername(username);

      try {
        // Fetch articles from backend API
        let apiArticles = [];
        try {
          const response = await fetch(`${import.meta.env.VITE_API_URL}/api/articles`);

          if (response.ok) {
            apiArticles = await response.json();
          } else {
            console.warn("Failed to fetch articles from API");
          }
        } catch (apiError) {
          console.error("API fetch failed:", apiError);
        }

        // Get user news from localStorage as fallback
        const userNews = JSON.parse(localStorage.getItem('userNews') || '[]');

        // Combine API articles and user news (prioritize API articles)
        const allArticles = [...apiArticles, ...userNews];

        // Remove duplicates by ID (API articles take precedence)
        const uniqueArticles = allArticles.filter((article, index, self) => 
          index === self.findIndex(a => a.id === article.id)
        );

        setArticles(uniqueArticles);
      } catch (error) {
        console.error("Failed to load articles:", error);
        toast({
          title: "Error",
          description: "Failed to load articles",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    checkAdminAndLoadArticles();
  }, [navigate]);

  // Filter articles based on search and category
  const filteredArticles = articles.filter(article => {
    const matchesSearch = article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         article.excerpt.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || article.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });



  // Delete article function
  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this article? This cannot be undone.")) {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          toast({
            title: "Authentication Error",
            description: "Please log in again to delete articles.",
            variant: "destructive",
          });
          navigate("/admin-login");
          return;
        }

        // Check if this is a backend article (has numeric ID) or localStorage article
        const article = articles.find(a => a.id === id || a.id.toString() === id);
        const isBackendArticle = article && typeof article.id === 'string' && !isNaN(parseInt(article.id));

        let deleteSuccess = false;

        // Try to delete from backend if it's a backend article
        if (isBackendArticle) {
          try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/articles/${article.id}`, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            });

            if (response.ok) {
              deleteSuccess = true;
            } else {
              // Article might not exist in backend, but we'll still remove it from local state
              console.warn(`Article ${article.id} not found in backend, removing from local state`);
            }
          } catch (apiError) {
            console.warn("Backend delete failed:", apiError);
            // Continue to remove from local state even if backend delete fails
          }
        }

        // Update local state - remove from both backend and localStorage articles
        const updatedArticles = articles.filter(article => article.id !== id && article.id.toString() !== id);
        setArticles(updatedArticles);

        // Also remove from localStorage if it exists there
        const userNews = JSON.parse(localStorage.getItem('userNews') || '[]');
        const updatedUserNews = userNews.filter((article: NewsItem) => article.id !== id && article.id.toString() !== id);
        localStorage.setItem('userNews', JSON.stringify(updatedUserNews));

        toast({
          title: "Article Deleted",
          description: "The article has been successfully deleted",
          variant: "default",
        });
      } catch (error) {
        console.error("Failed to delete article:", error);
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to delete article",
          variant: "destructive",
        });
      }
    }
  };

  // Check if a URL is valid
  const checkUrl = async (url: string): Promise<boolean> => {
    try {
      // Use a simple HEAD request to check if the URL is accessible
      const response = await fetch(url, {
        method: 'HEAD',
        mode: 'no-cors', // Allow CORS for external URLs
      });
      return true;
    } catch (error) {
      return false;
    }
  };

  // Check all external links for broken links
  const checkBrokenLinks = async () => {
    setCheckingLinks(true);
    const broken: string[] = [];
    
    for (const article of articles) {
      if (article.externalLink) {
        const isValid = await checkUrl(article.externalLink);
        if (!isValid) {
          broken.push(article.id);
        }
      }
    }
    
    setBrokenLinks(broken);
    setCheckingLinks(false);
    
    if (broken.length > 0) {
      toast({
        title: "Broken Links Found",
        description: `${broken.length} broken external links detected. Articles with broken links are highlighted in red.`,
        variant: "destructive",
      });
    } else {
      toast({
        title: "All Links Valid",
        description: "No broken external links found.",
        variant: "default",
      });
    }
  };

  // Logout function
  const handleLogout = () => {
    localStorage.removeItem("isAdmin");
    localStorage.removeItem("adminUsername");
    localStorage.removeItem("token");
    navigate("/");
    toast({
      title: "Logged Out",
      description: "You have been logged out successfully",
    });
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
        {/* Header with welcome and logout */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold">Welcome, {adminUsername}!</h1>
            <p className="text-muted-foreground">Manage your EntertainmentGHC content</p>
          </div>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="flex items-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Total Articles</div>
              <div className="text-3xl font-bold">{articles.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Categories</div>
              <div className="text-3xl font-bold">6</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Last Updated</div>
              <div className="text-3xl font-bold">
                {articles.length > 0
                  ? new Date(articles[0].date).toLocaleDateString()
                  : "N/A"}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Bar */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <h2 className="text-2xl font-bold">Your Articles</h2>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button asChild className="flex items-center gap-2">
              <Link to="/post-news">
                <PlusCircle className="h-4 w-4" />
                New Article
              </Link>
            </Button>
            <Button 
              onClick={checkBrokenLinks} 
              disabled={checkingLinks}
              className="flex items-center gap-2"
            >
              🔗 Check Broken Links
            </Button>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search articles by title or content..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-4 flex-wrap">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="afrobeats">Afrobeats</SelectItem>
                <SelectItem value="nollywood">Nollywood</SelectItem>
                <SelectItem value="culture">Culture</SelectItem>
                <SelectItem value="fashion">Fashion</SelectItem>
                <SelectItem value="tech">Tech</SelectItem>
                <SelectItem value="music">Music</SelectItem>
              </SelectContent>
            </Select>

            <Select value={contentTypeFilter} onValueChange={setContentTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by content type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Content Types</SelectItem>
                <SelectItem value="article">News Article</SelectItem>
                <SelectItem value="feature">Feature Story</SelectItem>
                <SelectItem value="headline">Headline</SelectItem>
                <SelectItem value="announcement">Announcement</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Articles Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead className="hidden md:table-cell">Category</TableHead>
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead className="hidden md:table-cell">Read Time</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredArticles.length > 0 ? (
                  filteredArticles.map(article => (
                    <TableRow key={article.id}>
                      <TableCell className="font-medium max-w-[250px] truncate">
                        {article.title}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <CategoryBadge category={article.category} />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {article.date}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {article.readTime}
                      </TableCell>
                      <TableCell className="flex gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/edit-news/${article.id}`}>
                            <Edit2 className="h-4 w-4 mr-1" />
                            Edit
                          </Link>
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(article.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      {searchTerm || categoryFilter !== "all" ? (
                        <div className="flex flex-col items-center gap-4">
                          <p className="text-muted-foreground">No articles match your search criteria</p>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setSearchTerm("");
                              setCategoryFilter("all");
                            }}
                          >
                            Clear Filters
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-4">
                          <p className="text-muted-foreground">No articles posted yet</p>
                          <Button asChild>
                            <Link to="/post-news">
                              <PlusCircle className="mr-2 h-4 w-4" />
                              Post Your First Article
                            </Link>
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;