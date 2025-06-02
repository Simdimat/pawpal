
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, Home, MessageSquare, Map, AlertTriangle, HospitalIcon, Dog, Users } from 'lucide-react'; // Added Dog icon

const navItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/#map-section', label: 'Pet Map', icon: Map },
  { href: '/#emergency-section', label: 'Emergency', icon: AlertTriangle },
  { href: '/#vets-section', label: 'Vets Info', icon: HospitalIcon },
  { href: '/#dog-day-out-section', label: 'Dog Day Out', icon: Dog }, // Changed from Users to Dog
  // Chat is now a sidebar on home, so direct nav link might be less crucial.
  // Could add a link to scroll to chat: { href: '/#chat-sidebar', label: 'Ask PawPal', icon: MessageSquare }
];

const NavMenu = () => {
  const pathname = usePathname();
  // For hash links, active state based on exact href match won't work well if pathname is just '/'
  // We'll keep the logic, it will highlight 'Home' correctly. Other links will navigate but not highlight.

  const commonLinkClasses = "text-sm font-medium transition-colors hover:text-primary flex items-center gap-2";
  const activeLinkClasses = "text-primary font-semibold";
  const inactiveLinkClasses = "text-foreground/80";

  return (
    <>
      <nav className="hidden md:flex items-center space-x-4 lg:space-x-6">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              commonLinkClasses,
              pathname === item.href ? activeLinkClasses : inactiveLinkClasses
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left">
            <nav className="grid gap-4 py-6">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex w-full items-center py-2 text-lg font-medium hover:text-primary gap-3 px-4",
                    pathname === item.href ? activeLinkClasses : inactiveLinkClasses
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
};

export default NavMenu;
