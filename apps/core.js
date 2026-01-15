import { REDIS_YUNZAI_DEER_PIPE, REDIS_YUNZAI_DEER_PIPE_ENERGY } from "../constants/core.js";
import { generateImage } from "../utils/core.js";
import { redisExistAndGetKey, redisSetKey, redisDeleteKey } from "../utils/redis-util.js";
import common from "../../../lib/common/common.js";

export class DeerPipe extends plugin {
    constructor() {
        super({
            name: "🦌管",
            dsc: "一个🦌管签到插件，发送🦌以进行签到",
            event: "message",
            priority: 5000,
            rule: [
                {
                    reg: "^(🦌|🦒|鹿|打胶)$",
                    fnc: "lu",
                },
                {
                    reg: "^补(🦌|🦒|鹿|打胶)\\s*[0-9]+$",
                    fnc: "makeupLu",
                },
                {
                    reg: "^戒(🦌|🦒|鹿|打胶)\\s*[0-9]*$",
                    fnc: "withdrawalLu",
                },
                {
                    reg: "^#鹿鹿查询$",
                    fnc: "viewLu",
                },
                {
                    reg: "^#鹿鹿统计$",
                    fnc: "deerGroupStats",
                },
                {
                    reg: "^#总鹿鹿统计$",
                    fnc: "totalDeerStats",
                },
                {
                    reg: "^#(?:强制)?清空鹿数据$",
                    fnc: "confirmClearDeerData",
                },
                {
                    reg: "^#确认清空鹿数据$",
                    fnc: "clearDeerData",
                },
                {
                    reg: "^#鹿鹿体力查询$",
                    fnc: "viewVitality",
                },
                {
                    reg: "^#鹿鹿健康报告",
                    fnc: "deerHealthReport",
                },
                {
                    reg: "^#休息$",
                    fnc: "sleep",
                },
                {
                    reg: "^#清理鹿鹿记录",
                    fnc: "clearUserDeerData",
                    permission: "admin"
                }
            ]
        })
    }

    filterMessageContent(text) {
        if (!text) return '';
        return text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s\-_()（）【】\[\]{}，。！？、：；""''…~@#$%^&*+=|\\/<>]/g, '');
    }

    async getSignData(user_id, day) {
        const deerData = await redisExistAndGetKey(REDIS_YUNZAI_DEER_PIPE) || {};
        const userId = parseInt(user_id);
        const dayKey = String(day);
        if (!deerData[userId]) {
            return undefined;
        }
        return deerData[userId][dayKey];
    }

    _getVitalityStatus(vitality) {
        if (vitality >= 80) return { name: "精力充沛", color: "🟢", desc: "肾气充足，精神饱满" };
        if (vitality >= 50) return { name: "状态正常", color: "🟡", desc: "精力尚可，注意节制" };
        if (vitality >= 20) return { name: "精力不济", color: "🟠", desc: "肾气亏损，需要休养" };
        if (vitality >= 0) return { name: "精疲力尽", color: "🔴", desc: "元气大伤，必须修养" };
        return { name: "严重透支", color: "⚫", desc: "极度透支，强烈建议修养" };
    }

    _calculatePunishment(userData, todayCount) {
        let punishment = 0;
        if (userData.consecutiveDays > 0) {
            punishment += userData.consecutiveDays * 0.15;
        }
        if (todayCount > 0) {
            punishment += todayCount * 0.3;
        }
        if (userData.kidneyHealth < 60) {
            punishment += (100 - userData.kidneyHealth) * 0.01;
        }
        const hour = new Date().getHours();
        if (hour >= 23 || hour < 5) {
            punishment += 0.5;
        }
        return Math.min(2.0, punishment);
    }

    async _updateVitalityRecovery(user_id) {
        const energyData = await redisExistAndGetKey(REDIS_YUNZAI_DEER_PIPE_ENERGY) || {};
        const userId = parseInt(user_id);
        const now = Date.now();
        const today = new Date().toDateString();
        
        if (!energyData[userId]) {
            energyData[userId] = {
                currentVitality: 100,
                kidneyHealth: 100,
                baseRecovery: 6,
                lastUpdateTime: now,
                consecutiveDays: 0,
                abstinenceDays: 0,
                todayCount: 0,
                lastDeerDate: null,
                lastAbstinenceDate: null,
                isAbstaining: false,
                date: today
            };
        }
        
        if (energyData[userId].date !== today) {
            energyData[userId].todayCount = 0;
            energyData[userId].date = today;
        }
        
        const userData = energyData[userId];
        const hoursPassed = (now - (userData.lastUpdateTime || now)) / (1000 * 60 * 60);
        
        if (hoursPassed >= 0.1) {
            let recovery = hoursPassed * userData.baseRecovery;
            let multiplier = 1.0;
            
            if (userData.currentVitality < 0) {
                const overdraft = Math.abs(userData.currentVitality);
                multiplier += Math.min(2.0, overdraft / 50);
            }
            
            if (userData.abstinenceDays > 0) {
                if (userData.abstinenceDays <= 7) {
                    multiplier += userData.abstinenceDays * 0.15;
                } else {
                    multiplier += 7 * 0.15 + (userData.abstinenceDays - 7) * 0.1;
                }
            }
            
            if (userData.kidneyHealth < 60) {
                multiplier *= 0.9;
            }
            
            const hour = new Date().getHours();
            if (hour >= 22 || hour < 6) {
                multiplier *= 2.5;
            }
            
            if (userData.isAbstaining) {
                multiplier *= 2.0;
            }
            
            recovery *= multiplier;
            userData.currentVitality = userData.currentVitality + recovery;
            
            if (userData.abstinenceDays >= 1) {
                const healthRecovery = userData.abstinenceDays >= 3 ? 
                    hoursPassed * 0.3 : hoursPassed * 0.15;
                userData.kidneyHealth = Math.min(100, userData.kidneyHealth + healthRecovery);
            }
            
            userData.lastUpdateTime = now;
            await redisSetKey(REDIS_YUNZAI_DEER_PIPE_ENERGY, energyData);
        }
        
        return userData;
    }

    async getEnergyData(user_id) {
        const userData = await this._updateVitalityRecovery(user_id);
        const status = this._getVitalityStatus(userData.currentVitality);
        return {
            ...userData,
            status: status.name,
            statusColor: status.color,
            statusDesc: status.desc
        };
    }

    async _calculateDeerCost(user_id, isMakeup = false) {
        const userData = await this.getEnergyData(user_id);
        const todayCount = userData.todayCount || 0;
        let baseCost = isMakeup ? 30 : 25;
        
        const punishment = this._calculatePunishment(userData, todayCount);
        let totalCost = baseCost * (1 + punishment);
        
        if (userData.currentVitality < 0) {
            totalCost *= 2.0;
        } else if (userData.currentVitality < 30) {
            totalCost *= 1.3;
        }
        
        return Math.round(totalCost);
    }

    async _checkHealthBeforeDeer(user_id) {
        const userData = await this.getEnergyData(user_id);
        const warnings = [];
        let hasOverdraft = false;
        let hasHighCount = false;
        
        if (userData.currentVitality < 0) {
            hasOverdraft = true;
        } else if (userData.currentVitality < 10) {
            warnings.push("精力极度匮乏，强烈建议修养");
        } else if (userData.currentVitality < 30) {
            warnings.push("精力不足，鹿鹿可能加重疲劳");
        }
        
        if (userData.kidneyHealth < 40) {
            warnings.push(`健康度过低（${userData.kidneyHealth}/100），需要专业调理`);
        } else if (userData.kidneyHealth < 60) {
            warnings.push("健康度偏低，建议减少频率");
        }
        
        if (userData.consecutiveDays >= 7) {
            warnings.push(`连续鹿鹿${userData.consecutiveDays}天，严重影响健康`);
        } else if (userData.consecutiveDays >= 3) {
            warnings.push("连续鹿鹿会严重影响健康");
        }
        
        if (userData.todayCount >= 5) {
            hasHighCount = true;
        } else if (userData.todayCount >= 2) {
            warnings.push("今日次数已较多");
        }
        
        if (hasOverdraft && hasHighCount) {
            warnings.unshift(`精力严重透支，今日已${userData.todayCount}次，消耗将大幅增加`);
        } else if (hasOverdraft) {
            warnings.unshift("精力严重透支，消耗将大幅增加");
        } else if (hasHighCount) {
            warnings.unshift(`今日已${userData.todayCount}次，消耗将大幅增加`);
        }
        
        const cost = await this._calculateDeerCost(user_id);
        const recoveryHours = userData.currentVitality < 0 ? 
            "透支状态，恢复时间较长" : 
            Math.ceil(cost / userData.baseRecovery) + "小时";
        
        return {
            allowed: true,
            warnings,
            cost,
            recoveryHours,
            message: warnings.length > 0 ? 
                `⚠️ 警告：${warnings.join("；")}` :
                ""
        };
    }

    async sign(user_id, day, isMakeup = false, isWithdrawal = false) {
        const userId = parseInt(user_id);
        const signDay = parseInt(day);
        const currentMonth = new Date().getMonth() + 1;
        let deerData = await redisExistAndGetKey(REDIS_YUNZAI_DEER_PIPE) || {};

        if (!deerData[userId] || deerData[userId].lastSignMonth !== currentMonth) {
            deerData[userId] = { lastSignMonth: currentMonth };
        }

        const dayKey = String(signDay);
        const wKey = `w_${dayKey}`;
        
        if (deerData[userId][dayKey] === undefined) deerData[userId][dayKey] = 0;
        if (deerData[userId][wKey] === undefined) deerData[userId][wKey] = 0;

        if (isWithdrawal) {
            deerData[userId][wKey] += 1;
        } else if (isMakeup) {
            deerData[userId][dayKey] = 1;
        } else {
            deerData[userId][dayKey] += 1;
        }

        await redisSetKey(REDIS_YUNZAI_DEER_PIPE, deerData);
        return deerData;
    }

    async lu(e) {
        const { user_id, nickname, card } = e.sender;
        
        const healthCheck = await this._checkHealthBeforeDeer(user_id);
        if (!healthCheck.allowed) {
            await e.reply(healthCheck.message);
            return;
        }
        
        const date = new Date();
        const day = date.getDate();
        const signData = await this.sign(user_id, day);
        const userId = parseInt(user_id);
        
        const energyData = await redisExistAndGetKey(REDIS_YUNZAI_DEER_PIPE_ENERGY) || {};
        const userData = energyData[userId] || await this.getEnergyData(user_id);
        const cost = await this._calculateDeerCost(user_id);
        
        userData.currentVitality = userData.currentVitality - cost;
        userData.kidneyHealth = Math.max(0, userData.kidneyHealth - 1);
        userData.todayCount = (userData.todayCount || 0) + 1;
        userData.lastDeerDate = date.toDateString();
        
        const lastDate = userData.lastDeerDate;
        const today = date.toDateString();
        if (lastDate !== today) {
            const lastDateObj = lastDate ? new Date(lastDate) : null;
            const yesterday = new Date(date);
            yesterday.setDate(yesterday.getDate() - 1);
            if (lastDateObj && lastDateObj.toDateString() === yesterday.toDateString()) {
                userData.consecutiveDays = (userData.consecutiveDays || 0) + 1;
            } else {
                userData.consecutiveDays = 1;
            }
        }
        
        userData.isAbstaining = false;
        userData.abstinenceDays = 0;
        userData.lastUpdateTime = Date.now();
        
        energyData[userId] = userData;
        await redisSetKey(REDIS_YUNZAI_DEER_PIPE_ENERGY, energyData);
        
        const newUserEnergy = await this.getEnergyData(user_id);
        const raw = await generateImage(date, card || nickname, signData[userId], newUserEnergy.status);
        
        let replyText = `成功🦌了\n消耗精力：${cost}点\n当前精力：${newUserEnergy.currentVitality.toFixed(1)}`;
        if (newUserEnergy.currentVitality < 0) {
            replyText += `（严重透支）`;
        }
        if (healthCheck.warnings.length > 0) {
            replyText += `\n${healthCheck.message}`;
            replyText += `\n💡 建议使用：#休息`;
        }
        if (newUserEnergy.currentVitality < 0 && !healthCheck.warnings.some(w => w.includes("透支"))) {
            replyText += "\n🚨 精力严重透支，强烈建议修养恢复";
            replyText += `\n💡 建议使用：#休息`;
        } else if (newUserEnergy.currentVitality < 30 && newUserEnergy.currentVitality >= 0) {
            replyText += "\n⚠️ 精力不足，建议修养";
            replyText += `\n💡 建议使用：#休息`;
        }
        
        await e.reply([replyText, segment.image(raw)]);
    }

    async makeupLu(e) {
        const day = parseInt(/\d+/.exec(e.msg.trim())[0]);
        const nowDay = new Date().getDate();
        if (day > nowDay || day === 0) {
            logger.info("[鹿] 超过当前日期");
            return;
        }

        const { user_id, nickname, card } = e.sender;
        
        const healthCheck = await this._checkHealthBeforeDeer(user_id);
        if (!healthCheck.allowed) {
            await e.reply(healthCheck.message + "\n⚠️ 补🦌比正常更伤身，请谨慎");
            return;
        }
        
        const beforeSignData = await this.getSignData(user_id, day);
        const signData = await this.sign(user_id, day, true);
        const userId = parseInt(user_id);
        const dayKey = String(day);
        
        const energyData = await redisExistAndGetKey(REDIS_YUNZAI_DEER_PIPE_ENERGY) || {};
        const userData = energyData[userId] || await this.getEnergyData(user_id);
        const cost = await this._calculateDeerCost(user_id, true);
        
        userData.currentVitality = userData.currentVitality - cost;
        userData.kidneyHealth = Math.max(0, userData.kidneyHealth - 2);
        userData.lastUpdateTime = Date.now();
        
        energyData[userId] = userData;
        await redisSetKey(REDIS_YUNZAI_DEER_PIPE_ENERGY, energyData);
        
        const userEnergy = await this.getEnergyData(user_id);
        const raw = await generateImage(new Date(), card || nickname, signData[userId], userEnergy.status);
        
        const replyText = signData[userId][dayKey] === beforeSignData ? 
            "只能补🦌没有🦌的日子捏" : 
            `成功补🦌\n消耗精力：${cost}点（补🦌更伤身）\n当前精力：${userEnergy.currentVitality.toFixed(1)}${userEnergy.currentVitality < 0 ? '（透支）' : ''}`;
        
        await e.reply([replyText, segment.image(raw)]);
    }

    async withdrawalLu(e) {
        const nowDay = new Date().getDate();
        let day = parseInt(/\d+/.exec(e.msg.trim())?.[0] || nowDay);
        
        if (day > nowDay || day === 0) {
            logger.info("[鹿] 超过当前日期");
            return;
        }

        const { user_id, nickname, card } = e.sender;
        if (day === nowDay) {
            const todayDeerCount = await this.getSignData(user_id, day);
            if (todayDeerCount && todayDeerCount > 0) {
                await e.reply("你今天已经破戒了");
                return;
            }
        }
        
        const signData = await this.sign(user_id, day, false, true);
        const userId = parseInt(user_id);
        
        const energyData = await redisExistAndGetKey(REDIS_YUNZAI_DEER_PIPE_ENERGY) || {};
        const userData = energyData[userId] || await this.getEnergyData(user_id);
        const baseRecovery = 15;
        const abstinenceBonus = Math.min(10, (userData.abstinenceDays || 0) * 2);
        const recovery = baseRecovery + abstinenceBonus;
        
        userData.currentVitality = userData.currentVitality + recovery;
        const healthRecovery = userData.abstinenceDays >= 3 ? 3 : 2;
        userData.kidneyHealth = Math.min(100, userData.kidneyHealth + healthRecovery);
        userData.isAbstaining = true;
        userData.lastAbstinenceDate = new Date().toDateString();
        
        const lastAbstinenceDate = userData.lastAbstinenceDate;
        const today = new Date().toDateString();
        if (lastAbstinenceDate !== today) {
            const lastDateObj = lastAbstinenceDate ? new Date(lastAbstinenceDate) : null;
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            if (lastDateObj && lastDateObj.toDateString() === yesterday.toDateString()) {
                userData.abstinenceDays = (userData.abstinenceDays || 0) + 1;
            } else {
                userData.abstinenceDays = 1;
            }
        }
        
        userData.consecutiveDays = 0;
        userData.lastUpdateTime = Date.now();
        
        energyData[userId] = userData;
        await redisSetKey(REDIS_YUNZAI_DEER_PIPE_ENERGY, energyData);
        
        const userEnergy = await this.getEnergyData(user_id);
        const raw = await generateImage(new Date(), card || nickname, signData[userId], userEnergy.status);
        
        let replyText = `成功戒🦌了\n恢复精力：+${recovery}点\n当前精力：${userEnergy.currentVitality.toFixed(1)}`;
        if (userEnergy.currentVitality < 0) {
            replyText += `（仍在透支，继续修养）`;
        }
        if (userEnergy.abstinenceDays >= 3) {
            replyText += `\n🎉 已连续戒🦌${userEnergy.abstinenceDays}天，恢复速度提升！`;
        }
        
        await e.reply([replyText, segment.image(raw)]);
    }

    async viewLu(e) {
        let user, isAt = false;
        if (e.at) {
            const curGroup = e.group || Bot?.pickGroup(e.group_id);
            const membersMap = await curGroup?.getMemberMap();
            user = membersMap.get(parseInt(e.at));
            isAt = true;
        } else {
            user = e.sender;
        }
        const { user_id, nickname, card } = user;
        const userId = parseInt(user_id);
        const date = new Date();
        const signData = await redisExistAndGetKey(REDIS_YUNZAI_DEER_PIPE) || {};
        const curMonth = date.getMonth() + 1;
        
        if (!signData[userId] || signData[userId].lastSignMonth !== curMonth) {
            await e.reply(isAt ? "ta本月还没有🦌过呢~" : "你本月还没有🦌过呢~");
            return;
        }
        
        let totalCount = 0;
        let activeDays = 0;
        for (const day in signData[userId]) {
            if (day !== 'lastSignMonth' && signData[userId][day] > 0) {
                totalCount += signData[userId][day];
                activeDays++;
            }
        }
        const avgCount = activeDays > 0 ? Math.floor(totalCount / activeDays) : 0;
        const displayName = this.filterMessageContent(card || nickname);
        
        const userEnergy = await this.getEnergyData(user_id);
        const raw = await generateImage(date, card || nickname, signData[userId], userEnergy.status);
        
        const statsText = `📊 ${displayName} 的鹿鹿查询\n📅 统计月份：${curMonth}月\n🦌 总次数：${totalCount}次\n📆 活跃天数：${activeDays}天\n📈 平均每天：${avgCount}次`;
        
        await e.reply([statsText, segment.image(raw)]);
    }

    async deerGroupStats(e) {
        if (!e.group_id) {
            await e.reply("此功能只能在群聊中使用~");
            return;
        }

        const currentMonth = new Date().getMonth() + 1;
        const signData = await redisExistAndGetKey(REDIS_YUNZAI_DEER_PIPE) || {};
        const curGroup = e.group || Bot?.pickGroup(e.group_id);
        const membersMap = await curGroup?.getMemberMap();
        
        if (!membersMap) {
            await e.reply("获取群成员信息失败~");
            return;
        }

        let groupTotalCount = 0;
        let groupActiveUsers = 0;
        let groupActiveDays = 0;
        const userStats = [];

        for (const [userId, member] of membersMap) {
            const userData = signData[userId];
            if (userData && userData.lastSignMonth === currentMonth) {
                let userTotalCount = 0;
                let userActiveDays = 0;
                for (const day in userData) {
                    if (day !== 'lastSignMonth' && userData[day] > 0) {
                        userTotalCount += userData[day];
                        userActiveDays++;
                    }
                }
                if (userTotalCount > 0) {
                    groupTotalCount += userTotalCount;
                    groupActiveUsers++;
                    groupActiveDays += userActiveDays;
                    userStats.push({
                        name: this.filterMessageContent(member.card || member.nickname),
                        count: userTotalCount,
                        days: userActiveDays
                    });
                }
            }
        }

        userStats.sort((a, b) => b.count - a.count);

        let statsText = `📊 群聊鹿鹿统计\n📅 统计月份：${currentMonth}月\n🦌 群总次数：${groupTotalCount}次\n👥 活跃用户：${groupActiveUsers}人\n📆 总活跃天数：${groupActiveDays}天`;
        
        if (userStats.length > 0) {
            const medals = ['🥇', '🥈', '🥉', '🏅', '🏅'];
            statsText += `\n\n🏆 排行榜：\n`;
            userStats.slice(0, 5).forEach((user, index) => {
                statsText += `${medals[index]} ${user.name}: ${user.count}次 (${user.days}天)\n`;
            });
        }

        await e.reply(statsText);
    }

    async totalDeerStats(e) {
        const currentMonth = new Date().getMonth() + 1;
        const signData = await redisExistAndGetKey(REDIS_YUNZAI_DEER_PIPE) || {};
        
        let globalTotalCount = 0;
        let globalActiveUsers = 0;
        let globalActiveDays = 0;

        for (const userId in signData) {
            const userData = signData[userId];
            if (userData && userData.lastSignMonth === currentMonth) {
                let userTotalCount = 0;
                let userActiveDays = 0;
                for (const day in userData) {
                    if (day !== 'lastSignMonth' && userData[day] > 0) {
                        userTotalCount += userData[day];
                        userActiveDays++;
                    }
                }
                if (userTotalCount > 0) {
                    globalTotalCount += userTotalCount;
                    globalActiveUsers++;
                    globalActiveDays += userActiveDays;
                }
            }
        }

        let statsText = `📊 全局鹿鹿统计\n📅 统计月份：${currentMonth}月\n🦌 全局总次数：${globalTotalCount}次\n👥 活跃用户：${globalActiveUsers}人\n📆 总活跃天数：${globalActiveDays}天`;
        
        if (globalActiveDays > 0 || globalActiveUsers > 0) {
            const avgCount = globalActiveDays > 0 ? Math.floor(globalTotalCount / globalActiveDays) : 0;
            const avgUser = globalActiveUsers > 0 ? Math.floor(globalTotalCount / globalActiveUsers) : 0;
            statsText += `\n📈 平均每天：${avgCount}次\n👤 平均每人：${avgUser}次`;
        }

        await e.reply(statsText);
    }


    async clearDeerData(e) {
        const deerData = await redisExistAndGetKey(REDIS_YUNZAI_DEER_PIPE) || {};
        const isForce = /强制/.test(e.msg);
        let usersCount = 0, deerTotal = 0, withdrawalTotal = 0, activeDaysTotal = 0;

        for (const userId in deerData) {
            const userData = deerData[userId];
            if (!userData) continue;
            usersCount++;
            let userActiveDays = 0;
            for (const key in userData) {
                if (key === 'lastSignMonth') continue;
                if (!isNaN(key)) {
                    const c = Number(userData[key] || 0);
                    if (c > 0) { deerTotal += c; userActiveDays++; }
                } else if (key.startsWith('w_')) {
                    withdrawalTotal += Number(userData[key] || 0);
                }
            }
            activeDaysTotal += userActiveDays;
        }

        const summary = `${isForce ? '已清空' : '即将清空'}全部鹿数据（签到与体力）\n👥 参与用户：${usersCount} 人\n🦌 鹿总次数：${deerTotal} 次\n❌ 戒鹿总次数：${withdrawalTotal} 次\n📆 累计活跃天数：${activeDaysTotal} 天`;
        
        if (isForce) {
            await redisDeleteKey(REDIS_YUNZAI_DEER_PIPE);
            await redisDeleteKey(REDIS_YUNZAI_DEER_PIPE_ENERGY);
            await e.reply(summary);
        } else {
            await e.reply(`${summary}\n\n若确认，请发送：#确认清空鹿数据`);
        }
    }

    async confirmClearDeerData(e) {
        await redisDeleteKey(REDIS_YUNZAI_DEER_PIPE);
        await redisDeleteKey(REDIS_YUNZAI_DEER_PIPE_ENERGY);
        await e.reply("已清空全部鹿数据（签到与体力）");
    }

    async viewVitality(e) {
        let user, isAt = false;
        if (e.at) {
            const curGroup = e.group || Bot?.pickGroup(e.group_id);
            const membersMap = await curGroup?.getMemberMap();
            user = membersMap.get(parseInt(e.at));
            isAt = true;
        } else {
            user = e.sender;
        }
        
        const { user_id, nickname, card } = user;
        const userEnergy = await this.getEnergyData(user_id);
        const status = this._getVitalityStatus(userEnergy.currentVitality);
        
        const healthBar = this._generateHealthBar(userEnergy.currentVitality);
        const kidneyBar = this._generateHealthBar(userEnergy.kidneyHealth, 100);
        
        const displayName = this.filterMessageContent(card || nickname);
        let text = `⚡ ${displayName} 的精力状态\n`;
        text += `==================\n`;
        text += `当前精力：${userEnergy.currentVitality.toFixed(1)}`;
        if (userEnergy.currentVitality < 0) {
            text += `（透支 ${Math.abs(userEnergy.currentVitality).toFixed(1)}）`;
        }
        text += `\n${healthBar}\n`;
        text += `状态：${status.color} ${status.name}\n`;
        text += `${status.desc}\n\n`;
        text += `🏥 健康指标\n`;
        text += `健康度：${userEnergy.kidneyHealth}/100\n`;
        text += `${kidneyBar}\n`;
        if (userEnergy.kidneyHealth < 70) {
            text += `⚠️ 警告：健康度偏低\n`;
        } else {
            text += `✅ 健康状态良好\n`;
        }
        text += `\n📊 统计信息\n`;
        text += `连续鹿鹿：${userEnergy.consecutiveDays || 0}天\n`;
        text += `连续戒🦌：${userEnergy.abstinenceDays || 0}天\n`;
        text += `今日次数：${userEnergy.todayCount || 0}次\n`;
        if (userEnergy.currentVitality < 0) {
            const hoursNeeded = Math.ceil(Math.abs(userEnergy.currentVitality) / userEnergy.baseRecovery);
            text += `\n⏳ 恢复到0需要约 ${hoursNeeded} 小时`;
        } else if (userEnergy.currentVitality < 100) {
            const hoursNeeded = Math.ceil((100 - userEnergy.currentVitality) / userEnergy.baseRecovery);
            text += `\n⏳ 恢复到100需要约 ${hoursNeeded} 小时`;
        }
        
        await e.reply(text);
    }

    _generateHealthBar(current, max = 100) {
        if (current < 0) {
            const overdraft = Math.abs(current);
            const filled = Math.min(10, Math.round(overdraft / 10));
            return "⬛".repeat(filled) + "⬜".repeat(10 - filled) + ` 透支${overdraft.toFixed(1)}`;
        }
        const percentage = Math.min(100, Math.round((current / max) * 100));
        const filled = Math.round(percentage / 10);
        const empty = 10 - filled;
        let bar = "";
        if (percentage >= 80) bar = "🟩".repeat(filled) + "⬜".repeat(empty);
        else if (percentage >= 50) bar = "🟨".repeat(filled) + "⬜".repeat(empty);
        else if (percentage >= 20) bar = "🟧".repeat(filled) + "⬜".repeat(empty);
        else bar = "🟥".repeat(filled) + "⬜".repeat(empty);
        return `${bar} ${percentage}%`;
    }

    async deerHealthReport(e) {
        let user, isAt = false;
        if (e.at) {
            const curGroup = e.group || Bot?.pickGroup(e.group_id);
            const membersMap = await curGroup?.getMemberMap();
            user = membersMap.get(parseInt(e.at));
            isAt = true;
        } else {
            user = e.sender;
        }
        
        const { user_id, nickname, card } = user;
        const userEnergy = await this.getEnergyData(user_id);
        const status = this._getVitalityStatus(userEnergy.currentVitality);
        const deerData = await redisExistAndGetKey(REDIS_YUNZAI_DEER_PIPE) || {};
        const userId = parseInt(user_id);
        const currentMonth = new Date().getMonth() + 1;
        
        let monthCount = 0;
        let activeDays = 0;
        if (deerData[userId] && deerData[userId].lastSignMonth === currentMonth) {
            for (const day in deerData[userId]) {
                if (day !== 'lastSignMonth' && deerData[userId][day] > 0) {
                    monthCount += deerData[userId][day];
                    activeDays++;
                }
            }
        }
        
        const healthBar = this._generateHealthBar(userEnergy.currentVitality);
        const kidneyBar = this._generateHealthBar(userEnergy.kidneyHealth, 100);
        const displayName = this.filterMessageContent(card || nickname);
        
        const advice = [];
        if (userEnergy.currentVitality < 0) {
            const hoursNeeded = Math.ceil(Math.abs(userEnergy.currentVitality) / userEnergy.baseRecovery);
            advice.push(`🚨 精力严重透支，建议修养至少 ${hoursNeeded} 小时`);
        } else if (userEnergy.currentVitality < 30) {
            advice.push("🚨 当前精力严重不足，建议暂停鹿鹿至少3天");
        }
        if (userEnergy.kidneyHealth < 60) {
            advice.push("💊 健康度偏低，建议戒🦌修养一周以上");
        }
        if (userEnergy.consecutiveDays > 3) {
            advice.push("⚠️ 连续天数过多，请给身体恢复时间");
        }
        if (userEnergy.todayCount > 5) {
            advice.push("🛑 今日次数过多，消耗将大幅增加");
        }
        if (userEnergy.currentVitality < 0) {
            const hoursNeeded = Math.ceil(Math.abs(userEnergy.currentVitality) / userEnergy.baseRecovery);
            advice.push(`⏳ 恢复到0需要约 ${hoursNeeded} 小时`);
        } else if (userEnergy.currentVitality < 100) {
            const hoursNeeded = Math.ceil((100 - userEnergy.currentVitality) / userEnergy.baseRecovery);
            advice.push(`⏳ 恢复到100需要约 ${hoursNeeded} 小时`);
        }
        
        let msg = [];
        
        let part1 = [`🦌 ${displayName} 的健康报告 🦌\n`, `==================\n`, `当前精力：${userEnergy.currentVitality.toFixed(1)}`];
        if (userEnergy.currentVitality < 0) {
            part1.push(`（透支 ${Math.abs(userEnergy.currentVitality).toFixed(1)}）`);
        }
        part1.push(`\n${healthBar}\n`, `状态：${status.color} ${status.name}\n`, `${status.desc}`);
        msg.push(part1);
        
        let part2 = [`🏥 健康指标\n`, `健康度：${userEnergy.kidneyHealth}/100\n`, `${kidneyBar}\n`];
        if (userEnergy.kidneyHealth < 70) {
            part2.push(`⚠️ 警告：健康度偏低`);
        } else {
            part2.push(`✅ 健康状态良好`);
        }
        msg.push(part2);
        
        let part3 = [`📊 本月统计\n`, `鹿鹿次数：${monthCount}次\n`, `戒🦌天数：${userEnergy.abstinenceDays || 0}天\n`, `活跃天数：${activeDays}天\n`];
        if (activeDays > 0) {
            part3.push(`平均每天：${(monthCount / activeDays).toFixed(1)}次\n`);
        }
        part3.push(`连续鹿鹿：${userEnergy.consecutiveDays || 0}天\n`, `连续戒🦌：${userEnergy.abstinenceDays || 0}天`);
        msg.push(part3);
        
        if (advice.length > 0) {
            msg.push([`💡 健康建议：\n`, advice.join("\n")]);
        } else {
            msg.push([`✅ 当前习惯良好，继续保持！`]);
        }
        
        await e.reply(common.makeForwardMsg(e, msg, `${displayName} 的健康报告`));
    }

    async sleep(e) {
        const { user_id, nickname, card } = e.sender;
        const userEnergy = await this.getEnergyData(user_id);
        const hour = new Date().getHours();
        const isSleepTime = hour >= 22 || hour < 6;
        const now = Date.now();
        
        const energyData = await redisExistAndGetKey(REDIS_YUNZAI_DEER_PIPE_ENERGY) || {};
        const userId = parseInt(user_id);
        const userData = energyData[userId] || userEnergy;
        
        const lastRestTime = userData.lastRestTime || 0;
        const restCooldown = 30 * 60 * 1000;
        const timeSinceLastRest = now - lastRestTime;
        
        if (timeSinceLastRest > 0 && timeSinceLastRest < restCooldown) {
            const remainingMinutes = Math.ceil((restCooldown - timeSinceLastRest) / 60000);
            await e.reply(`⏳ 休息间隔不足，请等待 ${remainingMinutes} 分钟后再试\n💡 休息间隔必须大于30分钟`);
            return;
        }
        
        let recovery = 0;
        let message = "";
        
        if (isSleepTime) {
            const baseSleepRecovery = 20;
            const multiplier = 2.5;
            recovery = baseSleepRecovery * multiplier;
            
            if (userData.abstinenceDays > 0) {
                recovery *= (1 + userData.abstinenceDays * 0.1);
            }
            
            if (userData.isAbstaining) {
                recovery *= 1.2;
            }
            
            recovery = Math.round(recovery);
            userData.currentVitality = userData.currentVitality + recovery;
            userData.lastUpdateTime = Date.now();
            userData.lastRestTime = now;
            
            if (userData.abstinenceDays >= 1) {
                const healthRecovery = userData.abstinenceDays >= 3 ? 2 : 1;
                userData.kidneyHealth = Math.min(100, userData.kidneyHealth + healthRecovery);
            }
            
            energyData[userId] = userData;
            await redisSetKey(REDIS_YUNZAI_DEER_PIPE_ENERGY, energyData);
            
            const newEnergy = await this.getEnergyData(user_id);
            message = `💤 进入深度睡眠...\n`;
            message += `恢复精力：+${recovery}点\n`;
            message += `当前精力：${newEnergy.currentVitality.toFixed(1)}`;
            if (newEnergy.currentVitality < 0) {
                message += `（透支 ${Math.abs(newEnergy.currentVitality).toFixed(1)}）`;
            }
            if (userData.abstinenceDays >= 1) {
                message += `\n🎉 睡眠期间恢复效果提升！`;
            }
        } else {
            const napRecovery = 5;
            recovery = napRecovery;
            
            if (userData.isAbstaining) {
                recovery = 8;
            }
            
            recovery = Math.round(recovery);
            userData.currentVitality = userData.currentVitality + recovery;
            userData.lastUpdateTime = Date.now();
            userData.lastRestTime = now;
            
            energyData[userId] = userData;
            await redisSetKey(REDIS_YUNZAI_DEER_PIPE_ENERGY, energyData);
            
            const newEnergy = await this.getEnergyData(user_id);
            const hoursUntilSleep = hour < 22 ? 22 - hour : 24 - hour;
            
            message = `😴 小憩片刻...\n`;
            message += `恢复精力：+${recovery}点\n`;
            message += `当前精力：${newEnergy.currentVitality.toFixed(1)}`;
            if (newEnergy.currentVitality < 0) {
                message += `（透支 ${Math.abs(newEnergy.currentVitality).toFixed(1)}）`;
            }
            message += `\n💡 提示：深度睡眠时段（22:00-6:00）恢复效果更佳！`;
            message += `\n⏰ 距离睡眠时段还有约 ${hoursUntilSleep} 小时`;
        }
        
        await e.reply(message);
    }

    async clearUserDeerData(e) {
        let targetUserId = null;
        let targetUser = null;
        let displayName = "";

        if (e.at) {
            const curGroup = e.group || Bot?.pickGroup(e.group_id);
            const membersMap = await curGroup?.getMemberMap();
            targetUser = membersMap.get(parseInt(e.at));
            if (targetUser) {
                targetUserId = parseInt(e.at);
                displayName = this.filterMessageContent(targetUser.card || targetUser.nickname);
            }
        } else {
            const msg = e.msg || e.raw_message || "";
            const qqMatch = msg.match(/\d{5,}/);
            if (qqMatch) {
                targetUserId = parseInt(qqMatch[0]);
                if (e.isGroup) {
                    const curGroup = e.group || Bot?.pickGroup(e.group_id);
                    const membersMap = await curGroup?.getMemberMap();
                    targetUser = membersMap.get(targetUserId);
                    if (targetUser) {
                        displayName = this.filterMessageContent(targetUser.card || targetUser.nickname);
                    } else {
                        displayName = `QQ:${targetUserId}`;
                    }
                } else {
                    displayName = `QQ:${targetUserId}`;
                }
            }
        }

        if (!targetUserId) {
            await e.reply("请 @用户 或提供QQ号\n格式：#清理鹿鹿记录 @用户 或 #清理鹿鹿记录 123456789");
            return;
        }

        const deerData = await redisExistAndGetKey(REDIS_YUNZAI_DEER_PIPE) || {};
        const energyData = await redisExistAndGetKey(REDIS_YUNZAI_DEER_PIPE_ENERGY) || {};
        
        let deerTotal = 0;
        let withdrawalTotal = 0;
        let activeDays = 0;
        const userDeerData = deerData[targetUserId];
        
        if (userDeerData) {
            for (const key in userDeerData) {
                if (key === 'lastSignMonth') continue;
                if (!isNaN(key)) {
                    const count = Number(userDeerData[key] || 0);
                    if (count > 0) {
                        deerTotal += count;
                        activeDays++;
                    }
                } else if (key.startsWith('w_')) {
                    withdrawalTotal += Number(userDeerData[key] || 0);
                }
            }
        }

        if (deerData[targetUserId]) {
            delete deerData[targetUserId];
            await redisSetKey(REDIS_YUNZAI_DEER_PIPE, deerData);
        }

        if (energyData[targetUserId]) {
            delete energyData[targetUserId];
            await redisSetKey(REDIS_YUNZAI_DEER_PIPE_ENERGY, energyData);
        }

        let report = `✅ 已清理 ${displayName} 的鹿鹿记录\n`;
        report += `==================\n`;
        report += `🦌 鹿总次数：${deerTotal} 次\n`;
        report += `❌ 戒鹿总次数：${withdrawalTotal} 次\n`;
        report += `📆 活跃天数：${activeDays} 天\n`;
        report += `⚡ 精力数据：已清空\n`;
        report += `🏥 健康数据：已清空`;

        await e.reply(report);
    }
}
