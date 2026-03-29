// 随机事件系统

/**
 * 随机数生成器
 * @param {number} min 最小值
 * @param {number} max 最大值
 * @returns {number} 随机数
 */
function random(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 随机触发判定
 * @param {number} probability 概率（0-100）
 * @returns {boolean} 是否触发
 */
function roll(probability) {
    return Math.random() * 100 < probability;
}

/**
 * 检查是否触发透支爆发
 * @param {number} energy 当前精力
 * @returns {object|null} 事件信息或null
 */
export function checkOverdraftBurst(energy) {
    if (energy <= 0 && roll(80)) {
        return {
            type: 'overdraft_burst',
            name: '透支爆发',
            desc: '你强行透支身体，气血大幅流失！',
            vitalityCost: random(15, 25),
            weakDuration: 12 // 小时
        };
    }
    return null;
}

/**
 * 检查是否触发精力爆发（正面事件）
 * @param {number} energy 当前精力
 * @returns {object|null} 事件信息或null
 */
export function checkEnergyBurst(energy) {
    if (roll(6)) { // 6%概率
        const recovery = random(10, 30); // 恢复10-30点精力
        return {
            type: 'energy_burst',
            name: '精力爆发',
            desc: '你突然感到精力充沛！',
            energyRecovery: recovery
        };
    }
    return null;
}

/**
 * 检查是否触发状态异常（负面事件）
 * @returns {object|null} 事件信息或null
 */
export function checkStatusAbnormal() {
    if (roll(4)) { // 4%概率
        const effects = [
            {
                name: '心火上升',
                desc: '你感到心烦意乱，心火上升',
                heartFire: 1
            },
            {
                name: '精神恍惚',
                desc: '你感到精神恍惚，注意力不集中',
                heartFire: 0.5
            }
        ];
        return {
            type: 'status_abnormal',
            ...effects[random(0, effects.length - 1)]
        };
    }
    return null;
}

/**
 * 检查是否触发意外中断
 * @returns {object|null} 事件信息或null
 */
export function checkInterruption() {
    if (roll(8)) { // 8%概率
        const reasons = [
            '隔壁突然有动静',
            '手机突然响起',
            '门外传来脚步声',
            '突然想起重要的事情',
            '身体突然不适'
        ];
        return {
            type: 'interruption',
            name: '意外中断',
            desc: reasons[random(0, reasons.length - 1)] + '，动作被打断。',
            energyCostReduction: 0.5, // 精力消耗减半
            heartFire: true // 产生心火
        };
    }
    return null;
}

/**
 * 检查深夜惩罚
 * @returns {object|null} 事件信息或null
 */
export function checkNightPunishment() {
    const hour = new Date().getHours();
    if (hour >= 0 && hour < 5) {
        return {
            type: 'night_punishment',
            name: '深夜惩罚',
            desc: '深夜执行对身体伤害更大！',
            vitalityCost: 10
        };
    }
    return null;
}

/**
 * 计算精力消耗（随机波动）
 * @param {number} baseMin 基础最小值
 * @param {number} baseMax 基础最大值
 * @returns {number} 实际消耗
 */
export function calculateEnergyCost(baseMin = 25, baseMax = 40) {
    return random(baseMin, baseMax);
}