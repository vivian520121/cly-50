import { Canvas } from '@/components/Canvas/Canvas';
import { TopToolbar, LeftToolbar } from '@/components/Toolbar/Toolbar';
import { PropertyPanel } from '@/components/PropertyPanel/PropertyPanel';
import { CustomShapesPanel } from '@/components/CustomShapesPanel/CustomShapesPanel';

export default function Home() {
  return (
    <div className="w-full h-full bg-[#FFFEF7]">
      <TopToolbar />
      <LeftToolbar />
      <Canvas />
      <PropertyPanel />
      <CustomShapesPanel />
    </div>
  );
}
