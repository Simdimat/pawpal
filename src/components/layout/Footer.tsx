const Footer = () => {
  return (
    <footer className="bg-card border-t border-border py-6">
      <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} PawPal SD. All rights reserved.</p>
        <p className="mt-1">Your AI Companion for San Diego Pet Life.</p>
      </div>
    </footer>
  );
};

export default Footer;
