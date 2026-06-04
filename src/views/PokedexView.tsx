import React from "react";
import { useApp } from "../AppContext";
import { Card, PetPlaceholder, PixelItemPlaceholder } from "../components/UI";
import { motion } from "motion/react";

export const PokedexView: React.FC = () => {
  const { weeklyPets, dailyHistory } = useApp();

  const isEmpty = weeklyPets.length === 0 && dailyHistory.length === 0;

  return (
    <div className="p-4 space-y-8 pb-24">
      <div className="text-center">
        <h2 className="text-xl font-bold bg-white inline-block px-2 border-2 border-[var(--color-brown)] rounded-md shadow-sm mb-2">我的圖鑑</h2>
        <p className="text-sm opacity-80 font-bold bg-white inline-block px-1 rounded shadow-sm border border-gray-200">你的音樂收藏冊</p>
      </div>

      {isEmpty ? (
        <Card className="text-center text-sm opacity-60 py-12">
          今天還沒有音樂紀錄♩
        </Card>
      ) : (
        <>
          <section className="space-y-4">
            <h3 className="font-bold border-b-2 border-dashed border-[var(--color-brown)] pb-2">本週寵物</h3>
            {weeklyPets.length === 0 ? (
               <div className="text-sm opacity-50 p-4 border-2 border-dashed border-[var(--color-brown)] text-center bg-[var(--color-cream)]">
                 尚未生成寵物
               </div>
            ) : (
               <div className="grid grid-cols-1 gap-4">
                 {weeklyPets.map((pet, idx) => (
                   <motion.div key={pet.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}>
                     <Card className="flex items-center space-x-4">
                       <PetPlaceholder baseType={pet.baseType} className="w-16 h-16 shrink-0" />
                       <div className="flex-1">
                          <div className="font-bold text-lg leading-tight">{pet.name}</div>
                          <div className="text-xs font-medium text-[var(--color-caramel)] mt-1">{pet.mainGenre}</div>
                          <div className="text-[10px] opacity-70 mt-1 line-clamp-1">{pet.description}</div>
                       </div>
                     </Card>
                   </motion.div>
                 ))}
               </div>
            )}
          </section>

          <section className="space-y-4">
            <h3 className="font-bold border-b-2 border-dashed border-[var(--color-brown)] pb-2">歷史物品</h3>
            {dailyHistory.length === 0 ? (
                <div className="text-sm opacity-50 text-center">空空如也</div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                 {dailyHistory.map((item, idx) => (
                    <motion.div key={item.id} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.05 }}>
                       <PixelItemPlaceholder genre={item.genre} part={item.part} className="w-full h-full aspect-square text-[8px]" />
                    </motion.div>
                 ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};
