import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Edit2, Trash2, PlusCircle, LogOut, Search, Star, Eye, EyeOff, Calendar, Clock, Tag } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import CategoryBadge from "@/components/CategoryBadge";
import { NewsItem } from "@/data/newsData";

const EnhancedAdminDashboard = () => {
  const [articles, setArticles] = useState<NewsItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [contentTypeFilter, setContentTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [featuredFilter, setFeaturedFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [adminUsername, setAdminUsername] = useState("");
  const [viewMode, setViewMode] = useState("all"); // 'all', 'featured', 'scheduled', 'drafts'
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
          const response = await fetch(`${import.meta.env.VITE_API_URL}/api/articles`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (response.ok) {
            apiArticles = await response.json();
          }
        } catch (apiError) {
          console.warn("API fetch failed:", apiError);
        }

        // Get user news from localStorage
        const userNews = JSON.parse(localStorage.getItem('userNews') || '[]');

        // Combine all articles, with admin articles first
        const allArticles = [...apiArticles, ...userNews];

        setArticles(allArticles);
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

  // Filter articles based on all criteria
  const filteredArticles = articles.filter(article => {
    const matchesSearch = article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         article.excerpt.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || article.category === categoryFilter;
    const matchesContentType = contentTypeFilter === "all" || article.contentType === contentTypeFilter;
    const matchesStatus = statusFilter === "all" || article.status === statusFilter;
    const matchesFeatured = featuredFilter === "all" || 
                           (featuredFilter === "featured" && article.featured) ||
                           (featuredFilter === "not-featured" && !article.featured);
    const matchesViewMode = viewMode === "all" || 
                           (viewMode === "featured" && article.featured) ||
                           (viewMode === "scheduled" && article.status === "scheduled") ||
                           (viewMode === "drafts" && article.status === "draft");

    return matchesSearch && matchesCategory && matchesContentType && matchesStatus && matchesFeatured && matchesViewMode;
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

        // Delete from backend API
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/articles/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to delete article');
        }

        // Update local state
        const updatedArticles = articles.filter(article => article.id !== id && article.id.toString() !== id);
        setArticles(updatedArticles);

        // Also update localStorage as fallback
        const userNews = JSON.parse(localStorage.getItem('userNews') || '[]');
        const updatedUserNews = userNews.filter(article => article.id !== id && article.id.toString() !== id);
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

  // Toggle featured status
  const handleToggleFeatured = async (id: string, currentFeatured: boolean) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast({
          title: "Authentication Error",
          description: "Please log in again to update articles.",
          variant: "destructive",
        });
        navigate("/admin-login");
        return;
      }

      // Update featured status in backend API
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/articles/${id}/featured`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ featured: !currentFeatured }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update featured status');
      }

      // Update local state
      const updatedArticles = articles.map(article => 
        article.id === id || article.id.toString() === id 
          ? { ...article, featured: !currentFeatured }
          : article
      );
      setArticles(updatedArticles);

      toast({
        title: "Featured Status Updated",
        description: `Article ${!currentFeatured ? 'marked as featured' : 'removed from featured'}`,
        variant: "default",
      });
    } catch (error) {
      console.error("Failed to update featured status:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update featured status",
        variant: "destructive",
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
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleLogout}
              variant="outline"
              className="flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
            <Button asChild className="flex items-center gap-2">
              <Link to="/post-news">
                <PlusCircle className="h-4 w-4" />
                New Article
              </Link>
            </Button>
          </div>
        </div>

        {/* View Mode Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Button
            variant={viewMode === "all" ? "default" : "outline"}
            onClick={() => setViewMode("all")}
            className="flex items-center gap-2"
          >
            <Tag className="h-4 w-4" />
            All Articles ({articles.length})
          </Button>
          <Button
            variant={viewMode === "featured" ? "default" : "outline"}
            onClick={() => setViewMode("featured")}
            className="flex items-center gap-2"
          >
            <Star className="h-4 w-4" />
            Featured ({articles.filter(a => a.featured).length})
          </Button>
          <Button
            variant={viewMode === "scheduled" ? "default" : "outline"}
            onClick={() => setViewMode("scheduled")}
            className="flex items-center gap-2"
          >
            <Calendar className="h-4 w-4" />
            Scheduled ({articles.filter(a => a.status === "scheduled").length})
          </Button>
          <Button
            variant={viewMode === "drafts" ? "default" : "outline"}
            onClick={() => setViewMode("drafts")}
            className="flex items-center gap-2"
          >
            <Clock className="h-4 w-4" />
            Drafts ({articles.filter(a => a.status === "draft").length})
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Total Articles</div>
              <div className="text-2xl font-bold">{articles.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Featured</div>
              <div className="text-2xl font-bold">{articles.filter(a => a.featured).length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Scheduled</div>
              <div className="text-2xl font-bold">{articles.filter(a => a.status === "scheduled").length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Drafts</div>
              <div className="text-2xl font-bold">{articles.filter(a => a.status === "draft").length}</div>
            </CardContent>
          </Card>
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
          <div className="flex flex-wrap gap-4">
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

            <Select value={featuredFilter} onValueChange={setFeaturedFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Filter by featured" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Articles</SelectItem>
                <SelectItem value="featured">Featured Only</SelectItem>
                <SelectItem value="not-featured">Not Featured</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Articles Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Articles</span>
              <span className="text-sm text-muted-foreground">
                Showing {filteredArticles.length} of {articles.length} articles
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead className="hidden md:table-cell">Category</TableHead>
                  <TableHead className="hidden md:table-cell">Type</TableHead>
                  <TableHead className="hidden md:table-cell">Status</TableHead>
                  <TableHead className="hidden md:table-cell">Featured</TableHead>
                  <TableHead className="hidden md:table-cell">Date</TableHead>
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
                        <span className="px-2 py-1 text-xs bg-secondary/50 rounded-full">
                          {article.contentType || 'article'}
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          article.status === 'published' ? 'bg-green-100 text-green-800' :
                          article.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {article.status || 'published'}
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Button
                          variant={article.featured ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleToggleFeatured(article.id, article.featured)}
                          className="flex items-center gap-2"
                        >
                          <Star className={`h-4 w-4 ${article.featured ? 'fill-current' : ''}`} />
                          {article.featured ? 'Featured' : 'Feature'}
                        </Button>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {article.date}
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
                    <TableCell colSpan={7} className="text-center py-8">
                      {searchTerm || categoryFilter !== "all" || contentTypeFilter !== "all" || statusFilter !== "all" || featuredFilter !== "all" ? (
                        <div className="flex flex-col items-center gap-4">
                          <p className="text-muted-foreground">No articles match your search criteria</p>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setSearchTerm("");
                              setCategoryFilter("all");
                              setContentTypeFilter("all");
                              setStatusFilter("all");
                              setFeaturedFilter("all");
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

export default EnhancedAdminDashboard;