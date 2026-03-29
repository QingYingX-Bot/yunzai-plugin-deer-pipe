// 状态描述工具 - 根据精力/气血百分比生成模糊化的状态描述

/**
 * 获取精力状态描述
 * @param {number} energy 当前精力值
 * @param {number} max 最大精力值
 * @returns {object} 状态信息
 */
export function getEnergyStatus(energy, max = 100) {
    const percentage = (energy / max) * 100;
    
    if (percentage > 80) {
        return {
            level: '充沛',
            desc: '你现在神清气爽，身体处于巅峰状态。',
            emoji: '🟢',
            color: '#4CAF50'
        };
    } else if (percentage > 50) {
        return {
            level: '正常',
            desc: '你感觉身体状态良好，精力尚可。',
            emoji: '🟡',
            color: '#FFC107'
        };
    } else if (percentage > 20) {
        return {
            level: '疲劳',
            desc: '你感到双腿微微发飘，注意力开始涣散。',
            emoji: '🟠',
            color: '#FF9800'
        };
    } else if (percentage > 0) {
        return {
            level: '虚弱',
            desc: '你感到浑身乏力，每一步都异常沉重。',
            emoji: '🔴',
            color: '#F44336'
        };
    } else {
        return {
            level: '透支',
            desc: '你已精疲力尽，身体发出警告信号。',
            emoji: '⚫',
            color: '#212121'
        };
    }
}

/**
 * 获取气血状态描述
 * @param {number} vitality 当前气血值
 * @param {number} max 最大气血值
 * @returns {object} 状态信息
 */
export function getVitalityStatus(vitality, max = 100) {
    const percentage = (vitality / max) * 100;
    
    if (percentage >= 70) {
        return {
            level: '充盈',
            desc: '你气血充盈，身体机能运转良好。',
            emoji: '💚',
            color: '#4CAF50'
        };
    } else if (percentage >= 40) {
        return {
            level: '平稳',
            desc: '你气血平稳，但需要适当休养。',
            emoji: '💛',
            color: '#FFC107'
        };
    } else if (percentage >= 10) {
        return {
            level: '亏损',
            desc: '你面色惨白，腰酸耳鸣，身体已不堪重负。',
            emoji: '🧡',
            color: '#FF9800'
        };
    } else {
        return {
            level: '枯竭',
            desc: '你已形同枯槁，随时可能彻底虚脱。',
            emoji: '❤️',
            color: '#F44336'
        };
    }
}

/**
 * 生成健康条
 * @param {number} current 当前值
 * @param {number} max 最大值
 * @param {number} length 条长度
 * @returns {string} 健康条字符串
 */
export function generateHealthBar(current, max = 100, length = 20) {
    const percentage = Math.max(0, Math.min(100, (current / max) * 100));
    const filled = Math.round((percentage / 100) * length);
    const empty = length - filled;
    
    let bar = '';
    if (percentage >= 70) {
        bar = '🟩'.repeat(filled) + '⬜'.repeat(empty);
    } else if (percentage >= 40) {
        bar = '🟨'.repeat(filled) + '⬜'.repeat(empty);
    } else if (percentage >= 10) {
        bar = '🟧'.repeat(filled) + '⬜'.repeat(empty);
    } else {
        bar = '🟥'.repeat(filled) + '⬜'.repeat(empty);
    }
    
    return `${bar} ${percentage.toFixed(1)}%`;
}