import { motion, AnimatePresence } from "framer-motion";
import { Crown, Gift, Sparkles, Star } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface LoyaltyConfig {
  enabled: boolean;
  visit_goal: number;
  reward_type: string;
  reward_description: string;
  reward_value: number;
}

interface CustomerVIPCardProps {
  customerName: string;
  visitCount: number;
  loyaltyConfig: LoyaltyConfig | null;
  rewardsClaimed: number;
}

const CustomerVIPCard = ({ customerName, visitCount, loyaltyConfig, rewardsClaimed }: CustomerVIPCardProps) => {
  const [showRewardPopup, setShowRewardPopup] = useState(false);

  if (!loyaltyConfig?.enabled) return null;

  const goal = loyaltyConfig.visit_goal;
  const currentProgress = visitCount % goal;
  const progressPercent = Math.min((currentProgress / goal) * 100, 100);
  const remaining = goal - currentProgress;
  const canClaim = currentProgress === 0 && visitCount > 0;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gradient-to-br from-amber-50/90 via-orange-50/90 to-yellow-50/90 dark:from-amber-900/30 dark:via-orange-900/30 dark:to-yellow-900/30 backdrop-blur-xl rounded-3xl p-4 border border-amber-200/50 dark:border-amber-700/30 shadow-lg"
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md">
            <Crown className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-sm">VIP Loyalty Card</p>
            <p className="text-[10px] text-muted-foreground">
              {customerName ? `Welcome, ${customerName}!` : "Your rewards progress"}
            </p>
          </div>
          {canClaim && (
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            >
              <Button
                size="sm"
                onClick={() => setShowRewardPopup(true)}
                className="bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs rounded-2xl shadow-md"
              >
                <Gift className="h-3.5 w-3.5 mr-1" /> Claim Reward!
              </Button>
            </motion.div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] font-medium">
            <span className="text-muted-foreground">{currentProgress} / {goal} visits</span>
            <span className="text-amber-600 dark:text-amber-400">
              {canClaim ? "🎉 Reward Ready!" : `${remaining} more to go`}
            </span>
          </div>
          <div className="relative">
            <Progress value={progressPercent} className="h-3 bg-amber-100 dark:bg-amber-900/50" />
            {/* Sparkle dots */}
            <div className="absolute top-0 left-0 right-0 h-3 flex items-center justify-between px-0.5">
              {Array.from({ length: goal }, (_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${
                    i < currentProgress
                      ? "bg-white shadow-sm"
                      : "bg-amber-200/50 dark:bg-amber-800/50"
                  }`}
                  style={{ visibility: goal <= 20 ? "visible" : "hidden" }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Reward Info */}
        <div className="mt-3 flex items-center gap-2 p-2 rounded-xl bg-white/50 dark:bg-black/20">
          <Star className="h-4 w-4 text-amber-500" />
          <p className="text-[11px] text-muted-foreground">
            <strong className="text-foreground">{loyaltyConfig.reward_description}</strong> after {goal} qualifying visits
          </p>
        </div>
      </motion.div>

      {/* Reward Claim Popup */}
      <AnimatePresence>
        {showRewardPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md p-6"
            onClick={() => setShowRewardPopup(false)}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: "spring", damping: 15 }}
              className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-gray-800 dark:to-gray-900 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border border-amber-200 dark:border-amber-800"
              onClick={(e) => e.stopPropagation()}
            >
              <motion.div
                animate={{ rotate: [0, 10, -10, 10, 0], scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: 2 }}
                className="inline-block mb-4"
              >
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto shadow-xl">
                  <Sparkles className="h-10 w-10 text-white" />
                </div>
              </motion.div>
              <h2 className="text-2xl font-bold mb-2">🎉 Congratulations!</h2>
              <p className="text-muted-foreground mb-4">
                You've completed <strong>{goal}</strong> visits!
              </p>
              <div className="p-4 rounded-2xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 mb-4">
                <Gift className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <p className="text-lg font-bold text-green-700 dark:text-green-400">
                  {loyaltyConfig.reward_description}
                </p>
                <p className="text-sm text-muted-foreground mt-1">Show this to your waiter to claim!</p>
              </div>
              <Button
                onClick={() => setShowRewardPopup(false)}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl h-12"
              >
                Awesome! 🥳
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default CustomerVIPCard;
