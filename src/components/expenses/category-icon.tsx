import type { LucideProps } from 'lucide-react';
import {
  Banknote,
  Car,
  HeartPulse,
  Home,
  Lightbulb,
  PiggyBank,
  ShoppingBag,
  Smile,
  Tag,
  Ticket,
  UtensilsCrossed,
} from 'lucide-react';
import type { FC } from 'react';

interface CategoryIconProps extends LucideProps {
  category: string;
}

export const CategoryIcon: FC<CategoryIconProps> = ({
  category,
  ...props
}) => {
  const normalizedCategory = category.toLowerCase().trim();

  switch (normalizedCategory) {
    case 'housing':
      return <Home {...props} />;
    case 'transportation':
      return <Car {...props} />;
    case 'food':
      return <UtensilsCrossed {...props} />;
    case 'utilities':
      return <Lightbulb {...props} />;
    case 'healthcare':
      return <HeartPulse {...props} />;
    case 'personal care':
      return <Smile {...props} />;
    case 'entertainment':
      return <Ticket {...props} />;
    case 'shopping':
      return <ShoppingBag {...props} />;
    case 'debt payments':
      return <Banknote {...props} />;
    case 'savings & investments':
      return <PiggyBank {...props} />;
    case 'miscellaneous':
    default:
      return <Tag {...props} />;
  }
};
