import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // pg carga drivers de forma dinamica; que Next no intente empaquetarlo.
  serverExternalPackages: ['pg'],
};

export default nextConfig;
