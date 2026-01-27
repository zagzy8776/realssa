import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Edit2, Trash2, PlusCircle, LogOut, Search } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import CategoryBadge from "@/components/CategoryBadge";
import { NewsItem } from "@/data/newsData";

const AdminDashboard = () => {
  const [articles, setArticles] = useState<NewsItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [adminUsername, setAdminUsername] = useState("");
  const navigate = useNavigate();

  // Check admin status and load articles
  useEffect(() => {
    const checkAdminAndLoadArticles = async () => {
      setIsLoading(true);

      // Check if user is admin
      const isAdmin = localStorage.getItem("isAdmin") === "true";
      if (!isAdmin) {
        navigate("/admin-login");
        return;
      }

      // Get admin username
      const username = localStorage.getItem("adminUsername") || "Admin";
      setAdminUsername(username);

      try {
        // Load ALL articles: static + user
        const { latestStories, nigeriaNews } = await import('@/data/newsData');
        const userNews = JSON.parse(localStorage.getItem('userNews') || '[]');

        // Combine all articles with source tracking
        const allArticles = [
          ...latestStories.map(article => ({ ...article, source: 'static' })),
          ...nigeriaNews.map(article => ({ ...article, source: 'static' })),
          ...userNews.map(article => ({ ...article, source: 'user' }))
        ];

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

  // Filter articles based on search and category
  const filteredArticles = articles.filter(article => {
    const matchesSearch = article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         article.excerpt.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || article.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Make static article editable by converting to user article
  const handleMakeEditable = (article: NewsItem) => {
    try {
      const userNews = JSON.parse(localStorage.getItem('userNews') || '[]');

      // Check if already converted
      const alreadyExists = userNews.some(item => item.id === article.id);

      if (!alreadyExists) {
        const updatedUserNews = [...userNews, {
          ...article,
          originalSource: 'static' // Track that this was originally static
        }];

        localStorage.setItem('userNews', JSON.stringify(updatedUserNews));

        // Update the articles list to reflect the change
        setArticles(prevArticles =>
          prevArticles.map(a =>
            a.id === article.id ? { ...a, source: 'user', originalSource: 'static' } : a
          )
        );

        toast({
          title: "Success!",
          description: "Article is now editable. You can modify it like any other article.",
          variant: "default",
        });
      } else {
        toast({
          title: "Already Editable",
          description: "This article is already available for editing.",
          variant: "default",
        });
      }
    } catch (error) {
      console.error("Failed to make article editable:", error);
      toast({
        title: "Error",
        description: "Failed to make article editable",
        variant: "destructive",
      });
    }
  };

  // Delete article function
  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this article? This cannot be undone.")) {
      try {
        const updatedArticles = articles.filter(article => article.id !== id);
        const userNews = JSON.parse(localStorage.getItem('userNews') || '[]');
        const updatedUserNews = userNews.filter(article => article.id !== id);

        localStorage.setItem('userNews', JSON.stringify(updatedUserNews));
        setArticles(updatedArticles);

        toast({
          title: "Article Deleted",
          description: "The article has been successfully deleted",
          variant: "default",
        });
      } catch (error) {
        console.error("Failed to delete article:", error);
        toast({
          title: "Error",
          description: "Failed to delete article",
          variant: "destructive",
        });
      }
    }
  };

  // Logout function
  const handleLogout = () => {
    localStorage.removeItem("isAdmin");
    localStorage.removeItem("adminUsername");
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
          <div className="flex gap-4">
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

            {/* Source Filter */}
            <Select value="all" onValueChange={(value) => {
              // This would require adding sourceFilter state
              // For now, this is a placeholder for future enhancement
            }}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Filter by source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="static">Static Articles</SelectItem>
                <SelectItem value="user">Your Articles</SelectItem>
                <SelectItem value="converted">Converted</SelectItem>
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
                        {article.source === 'static' ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleMakeEditable(article)}
                            >
                              <Edit2 className="h-4 w-4 mr-1" />
                              Make Editable
                            </Button>
                            <span className="text-xs text-muted-foreground px-2 py-1 bg-card border rounded-full flex items-center">
                              Static
                            </span>
                          </>
                        ) : (
                          <>
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
                            {article.originalSource === 'static' && (
                              <span className="text-xs text-muted-foreground px-2 py-1 bg-card border rounded-full flex items-center">
                                Converted
                              </span>
                            )}
                          </>
                        )}
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