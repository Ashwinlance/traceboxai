import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { AdminDashboard } from './components/dashboard/AdminDashboard';
import { MobileSurveyorView } from './components/surveyor/MobileSurveyorView';
import { ReviewQueue } from './components/supervisor/ReviewQueue';
import { useParcels } from './store/parcelContext';

export default function App() {
  const { role } = useParcels();
  return <div className="app-shell"><Header/><div className="main-shell"><Sidebar/><div className="content">{role==='ADMIN'?<AdminDashboard/>:role==='SURVEYOR'?<MobileSurveyorView/>:<ReviewQueue/>}</div></div></div>;
}
