type Props = {
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'main' | 'section' | 'article';
  id?: string;
};

export function PageContainer({ children, className, as: Tag = 'div', id }: Props) {
  return (
    <Tag id={id} className={`mx-auto max-w-2xl px-4 sm:px-6 ${className ?? ''}`}>
      {children}
    </Tag>
  );
}
