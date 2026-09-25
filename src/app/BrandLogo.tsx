import diacoLogo from '../assets/images/diaco-logo-navy.png';

type BrandLogoVariant = 'auth' | 'mobile' | 'topbar';

export function BrandLogo({
  variant,
  logoUrl,
}: {
  variant: BrandLogoVariant;
  logoUrl?: string | null | undefined;
}) {
  return (
    <img
      className={`brand-logo brand-logo--${variant}`}
      src={logoUrl ?? diacoLogo}
      alt="لوگوی دیاکو الکترونیکس"
      onError={(event) => {
        event.currentTarget.src = diacoLogo;
      }}
    />
  );
}
