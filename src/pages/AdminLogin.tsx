import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";

const AdminLogin = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Simple admin authentication
    if (username === "admin" && password === "EntertainmentGHC2026!") {
      // Store admin status in localStorage
      localStorage.setItem("isAdmin", "true");
      localStorage.setItem("adminUsername", username);

      toast({
        title: "Login Successful",
        description: "Welcome back, Admin!",
        variant: "default",
      });

      // Redirect to admin dashboard
      setTimeout(() => navigate("/admin-dashboard"), 1000);
    } else {
      setIsLoading(false);
      toast({
        title: "Login Failed",
        description: "Invalid username or password",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-12">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">Admin Login</CardTitle>
            <p className="text-muted-foreground text-center">EntertainmentGHC Administration</p>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="username" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Username
                </label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  placeholder="Enter admin username"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter admin password"
                />
              </div>

              <div className="pt-4">
                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading ? "Logging in..." : "Login"}
                </Button>
              </div>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              <p>EntertainmentGHC Admin Portal</p>
              <p className="mt-2">For authorized personnel only</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Footer />
    </div>
  );
};

export default AdminLogin;