import { TrainDashboard } from "@/features/trains/TrainDashboard";

/**
 * トップページ(サーバーコンポーネント)。
 * 対話が必要な部分のみクライアントコンポーネント(TrainDashboard)に委譲し、
 * クライアント境界を最小限にする。
 */
export default function HomePage() {
  return <TrainDashboard />;
}
