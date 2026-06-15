type Props = {
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'main' | 'section' | 'article';
};

export function PageContainer({ children, className, as: Tag = 'div' }: Props) {
  return <Tag className={`mx-auto max-w-2xl px-4 sm:px-6 ${className ?? ''}`}>{children}</Tag>;
}
