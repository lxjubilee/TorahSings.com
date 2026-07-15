import { BookBand } from '@/components/home/BookBand';
import { CatalogHero } from '@/components/home/CatalogHero';
import { CategoryRail } from '@/components/home/CategoryRail';
import { HoverPreviewProvider } from '@/components/home/HoverPreview';
import { angelsCatalog } from '@/content/angels-catalog';
import styles from './page.module.css';

/**
 * Re-render hourly so albums dated in the future surface on their own.
 * (Mirrors CONTENT_REVALIDATE — Next requires a literal here.)
 */
export const revalidate = 3600;

export default function HomePage() {
  return (
    <>
      <CatalogHero />

      <HoverPreviewProvider>
        <div className={styles.browse} id="library">
          {angelsCatalog.map((category) => (
            <CategoryRail key={category.id} category={category} />
          ))}
        </div>
      </HoverPreviewProvider>

      <BookBand />
    </>
  );
}
