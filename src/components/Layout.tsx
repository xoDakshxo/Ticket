import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Ticket, BarChart3, MessageSquare, Settings, Search, LogOut, User, Moon, Sun } from "lucide-react";
import loopdIcon from "@/assets/loopd-icon.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/components/ThemeProvider";
interface LayoutProps {
  children: ReactNode;
}
const menuItems = [{
  icon: LayoutDashboard,
  label: "Dashboard",
  path: "/"
}, {
  icon: Ticket,
  label: "Tickets",
  path: "/tickets"
}, {
  icon: Settings,
  label: "Settings",
  path: "/settings"
}];
export function Layout({
  children
}: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const {
    theme,
    setTheme
  } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Signed out successfully"
    });
    navigate("/auth");
  };
  return <div className="min-h-screen w-full bg-background">
      {/* Floating Modern Navbar */}
      <nav className="fixed top-4 left-4 right-4 z-50 animate-fade-in">
        <div className="mx-auto max-w-7xl">
          <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl shadow-lg px-6 py-3">
            <div className="flex items-center justify-between">
              {/* Logo & Navigation */}
              <div className="flex items-center gap-8">
                <Link to="/" className="flex items-center gap-2 group">
                  <div className="h-8 w-8 rounded-lg overflow-hidden shadow-lg shadow-primary/20">
                    <img src={loopdIcon} alt="Loopd" className="h-full w-full object-cover" />
                  </div>
                  <h1 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">Loopd</h1>
                </Link>

                <div className="hidden md:flex items-center gap-1">
                  {menuItems.map(item => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return <Link key={item.path} to={item.path}>
                        <Button variant={isActive ? "secondary" : "ghost"} size="sm" className={`gap-2 transition-all ${isActive ? "bg-primary/10 text-primary hover:bg-primary/20" : "hover:bg-muted"}`}>
                          <Icon className="h-4 w-4" />
                          <span className="font-medium">{item.label}</span>
                        </Button>
                      </Link>;
                })}
                </div>
              </div>

              {/* Search & Actions */}
              <div className="flex items-center gap-3">
                <div className="hidden sm:block relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="search" placeholder="Search..." className="pl-9 h-9 bg-background/50 border-border/50 focus:border-primary/50" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>
                
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-white">
                          <User className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>My Account</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Mobile Navigation */}
            <div className="md:hidden flex gap-1 mt-3 pt-3 border-t border-border/50">
              {menuItems.map(item => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return <Link key={item.path} to={item.path} className="flex-1">
                    <Button variant={isActive ? "secondary" : "ghost"} size="sm" className={`w-full gap-2 ${isActive ? "bg-primary/10 text-primary" : ""}`}>
                      <Icon className="h-4 w-4" />
                      <span className="text-xs">{item.label}</span>
                    </Button>
                  </Link>;
            })}
            </div>
          </div>
        </div>
      </nav>

      {/* Page Content */}
      <main className="pt-24 px-4 pb-8">
        <div className="mx-auto max-w-7xl">
          {children}
        </div>
      </main>
    </div>;
}