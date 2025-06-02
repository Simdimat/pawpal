import Link from 'next/link';
import NavMenu from './NavMenu';
import WeatherWidget from '../WeatherWidget';
import EmailAuth from '../EmailAuth';
import { PawPrint } from 'lucide-react';

const Header = () => {
  return (
    <header className="bg-card border-b border-border shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-2xl font-headline font-bold text-primary hover:text-primary/80 transition-colors">
          <PawPrint className="h-8 w-8 text-primary" />
          PawPal SD
        </Link>
        <div className="flex items-center gap-4">
          <NavMenu />
          <WeatherWidget />
          <EmailAuth />
        </div>
      </div>
    </header>
  );
};

export default Header;
