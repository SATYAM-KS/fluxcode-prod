export type Course = {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  price: number;
  is_published: boolean;
  created_at: string;
};
