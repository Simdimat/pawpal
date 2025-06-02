'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu } from 'lucide-react';

const navItems = [
  { href: '/', label: 'Home' },
  { href: '/chat', label: 'Ask PawPal' },
  { href: '/map', label: 'Pet Map' },
  { href: '/emergency', label: 'Emergency' },
  { href: '/vets', label: 'Vets Info' },
  { href: '/dog-day-out', label: 'Dog Day Out' },
];

const NavMenu = () => {
  const pathname = usePathname();

  const commonLinkClasses = "text-sm font-medium transition-colors hover:text-primary";
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
                    "flex w-full items-center py-2 text-lg font-medium hover:text-primary",
                    pathname === item.href ? activeLinkClasses : inactiveLinkClasses
                  )}
                >
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
