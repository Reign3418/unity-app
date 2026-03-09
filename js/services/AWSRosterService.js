class AWSRosterService {
    constructor() {
        this.db = null;
        this.connected = false;
        this.tableName = null;
        this.currentKingdom = null;
        this.unsubscribe = null;
        this.onDataCallback = null;
        this.onStatusCallback = null;

        // Polling interval reference since DynamoDB doesnt support WebSocket listeners
        this.pollingInterval = null;
    }

    init(configRaw) {
        if (!configRaw) {
            this.updateStatus(false, 'AWS Credentials not configured');
            return false;
        }

        try {
            let config;
            if (typeof configRaw === 'string') {
                config = JSON.parse(configRaw);
            } else {
                config = configRaw;
            }

            if (!config.accessKey || !config.secretKey || !config.region || !config.tableName) {
                this.updateStatus(false, 'Incomplete AWS Configuration');
                return false;
            }

            // Init AWS SDK globally
            AWS.config.update({
                accessKeyId: config.accessKey,
                secretAccessKey: config.secretKey,
                region: config.region
            });

            this.db = new AWS.DynamoDB.DocumentClient();
            this.tableName = config.tableName;

            this.connected = true;
            this.updateStatus(true, 'Connected to DynamoDB');
            return true;

        } catch (error) {
            console.error('AWS Init Error:', error);
            this.updateStatus(false, 'Initialization Failed');
            return false;
        }
    }

    updateStatus(isConnected, message) {
        if (this.onStatusCallback) {
            this.onStatusCallback(isConnected, message);
        }
    }

    // Subscribe to a specific Kingdom's roster.
    // AWS DynamoDB doesn't have real-time sockets like Firebase, so we poll every 15s instead.
    subscribeToKingdom(kingdomId, callback) {
        if (!this.db) return;

        this.onDataCallback = callback;

        // Clean up previous polling
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }

        this.currentKingdom = kingdomId;

        const fetchData = async () => {
            try {
                // Fetch the live Roster
                const params = {
                    TableName: this.tableName,
                    KeyConditionExpression: 'PK = :pk',
                    ExpressionAttributeValues: {
                        ':pk': `ROSTER#${kingdomId}`
                    }
                };

                const result = await this.db.query(params).promise();
                // We expect items like: PK=ROSTER#3155, SK=GOV#28471
                const players = result.Items ? result.Items.map(item => item.attributes) : [];

                if (this.onDataCallback) {
                    this.onDataCallback(players);
                }
            } catch (err) {
                console.error("DynamoDB subscribe/poll error", err);
            }
        };

        // Fetch immediately, then loop
        fetchData();
        this.pollingInterval = setInterval(fetchData, 15000); // 15 seconds
    }

    async pushPlayerScan(kingdomId, playerData) {
        if (!this.db || !this.connected) throw new Error('Not connected to AWS');
        if (!playerData.id && !playerData.name) throw new Error('Player must have ID or Name');

        let key = (playerData.id) ? String(playerData.id) : playerData.name.replace(/[.#$\[\]]/g, "_");

        const payload = {
            ...playerData,
            lastSync: Date.now()
        };

        try {
            const params = {
                TableName: this.tableName,
                Item: {
                    PK: `ROSTER#${kingdomId}`,
                    SK: `GOV#${key}`,
                    attributes: payload
                }
            };
            await this.db.put(params).promise();
            return true;
        } catch (error) {
            console.error('AWS Push Player Error:', error);
            throw error;
        }
    }

    async getKingdomDataOnce(kingdomId) {
        if (!this.db || !this.connected) throw new Error('Not connected to AWS');

        try {
            const params = {
                TableName: this.tableName,
                KeyConditionExpression: 'PK = :pk',
                ExpressionAttributeValues: {
                    ':pk': `ROSTER#${kingdomId}`
                }
            };

            const result = await this.db.query(params).promise();
            return result.Items ? result.Items.map(item => item.attributes) : [];
        } catch (error) {
            console.error('AWS Fetch Error:', error);
            throw error;
        }
    }

    async getActiveKingdoms() {
        if (!this.db || !this.connected) return [];
        // DynamoDB is not great at distinct queries.
        // We will store a global index of kingdoms.
        try {
            const params = {
                TableName: this.tableName,
                KeyConditionExpression: 'PK = :pk',
                ExpressionAttributeValues: {
                    ':pk': 'GLOBAL#KINGDOMS'
                }
            };
            const res = await this.db.query(params).promise();
            console.log("AWS getActiveKingdoms Raw Response:", res);
            return res.Items ? res.Items.map(i => i.SK.replace('KINGDOM#', '')) : [];
        } catch (error) {
            console.error('AWS Fetch Kingdoms Error:', error);
            return [];
        }
    }

    // ------------------------------------------------------------------------
    // GLOBAL CLOUD TRACKING & TIMELINE
    // ------------------------------------------------------------------------

    // Push an entire scan array to the cloud using AWS BatchWriteItem (max 25 docs per batch)
    async pushFullScan(kingdomId, scanDate, scanData) {
        if (!this.db || !this.connected) throw new Error('Not connected to AWS');

        const safeDate = String(scanDate).replace(/[.#$\/\[\]\s]/g, "_");

        let batchRequests = [];

        // 1. Maintain the global kingdom list
        batchRequests.push({
            PutRequest: {
                Item: {
                    PK: 'GLOBAL#KINGDOMS',
                    SK: `KINGDOM#${kingdomId}`,
                    attributes: { added: Date.now() }
                }
            }
        });

        // 2. Store the list of available scan dates for this Kingdom
        batchRequests.push({
            PutRequest: {
                Item: {
                    PK: `DATES#${kingdomId}`,
                    SK: `DATE#${safeDate}`,
                    attributes: { timestamp: Date.now(), scanDate }
                }
            }
        });

        // 3. Store the massive snapshot array 
        // Note: A single DynamoDB item has a 400KB limit. 
        // 1000 roster lines might exceed this if we cram it into one item attributes blob.
        // Instead, we store each player's specific scan instance as its own document: PK=SCAN#KID#DATE, SK=GOVID

        const originalHeaders = scanData.length > 0 ? Object.keys(scanData[0]) : [];

        // Store Headers
        batchRequests.push({
            PutRequest: {
                Item: {
                    PK: `SCAN_HEADERS#${kingdomId}#${safeDate}`,
                    SK: 'HEADERS',
                    attributes: originalHeaders
                }
            }
        });

        scanData.forEach(player => {
            const rawId = player['Governor ID'] || player['ID'] || player['id'];
            const rawName = player['Governor Name'] || player['Name'] || player['name'] || "Unknown";
            let key = (rawId) ? String(rawId) : rawName.replace(/[.#$\/\[\]\s]/g, "_");

            if (key !== "undefined" && key !== "Unknown") {
                // A. Atomic Snapshot Document for bulk downloading
                batchRequests.push({
                    PutRequest: {
                        Item: {
                            PK: `SCAN#${kingdomId}#${safeDate}`,
                            SK: `GOV#${key}`,
                            attributes: player
                        }
                    }
                });

                // B. Governor History Graph
                batchRequests.push({
                    PutRequest: {
                        Item: {
                            PK: `GOV_HISTORY#${key}`,
                            SK: `SCAN#${kingdomId}#${safeDate}`,
                            attributes: player
                        }
                    }
                });

                // C. Governor Global Profile Updater
                batchRequests.push({
                    PutRequest: {
                        Item: {
                            PK: `GOV_PROFILE#${key}`,
                            SK: 'PROFILE',
                            attributes: {
                                name: rawName,
                                lastSeenKingdom: kingdomId,
                                lastSeenDate: safeDate
                            }
                        }
                    }
                });
            }
        });

        // Process batches of 25 (DynamoDB Limit)
        const BATCH_SIZE = 25;
        for (let i = 0; i < batchRequests.length; i += BATCH_SIZE) {
            const chunk = batchRequests.slice(i, i + BATCH_SIZE);
            const params = {
                RequestItems: {
                    [this.tableName]: chunk
                }
            };
            try {
                await this.db.batchWrite(params).promise();
            } catch (err) {
                console.error("Batch write chunk failed:", err);
                throw err; // Stop the push and alert the UI immediately!
            }
        }

        return true;
    }

    async getAvailableScanDates(kingdomId) {
        if (!this.db || !this.connected) throw new Error('Not connected to AWS');
        try {
            const params = {
                TableName: this.tableName,
                KeyConditionExpression: 'PK = :pk',
                ExpressionAttributeValues: {
                    ':pk': `DATES#${kingdomId}`
                }
            };

            const result = await this.db.query(params).promise();
            if (result.Items) {
                return result.Items.map(i => i.attributes.scanDate).sort((a, b) => new Date(b) - new Date(a));
            }
            return [];
        } catch (e) {
            console.error("Error fetching AWS scan dates:", e);
            return [];
        }
    }

    // Look up a specific Governor ID to pull their entire lifetime history
    // Queries the GOV_HISTORY partition
    async getGovernorHistory(govId) {
        if (!this.db || !this.connected) throw new Error('Not connected to AWS');

        try {
            const safeKey = String(govId).replace(/[.#$\/\[\]\s]/g, "_");
            const params = {
                TableName: this.tableName,
                KeyConditionExpression: 'PK = :pk',
                ExpressionAttributeValues: {
                    ':pk': `GOV_HISTORY#${safeKey}`
                }
            };

            const result = await this.db.query(params).promise();
            if (!result.Items || result.Items.length === 0) return null;

            // Transform DynamoDB items back into a "history" object dictionary like Firebase does: { "1818_2024-05-01": { playerObj } }
            const historyObj = {
                profile: { name: "", lastSeenKingdom: "", lastSeenDate: "" },
                history: {}
            };

            result.Items.forEach(item => {
                // Determine Kingdom and Date from the SK (e.g. "SCAN#1818#2024-05-01")
                const skParts = item.SK.split('#');
                if (skParts.length >= 3) {
                    const kId = skParts[1];
                    const date = skParts.slice(2).join('#');
                    const historyKey = `${kId}_${date}`;
                    historyObj.history[historyKey] = item.attributes;

                    // Update root profile summary with latest seen
                    historyObj.profile.name = item.attributes['Governor Name'] || item.attributes['Name'] || item.attributes['name'] || historyObj.profile.name;
                    historyObj.profile.lastSeenKingdom = kId;
                    historyObj.profile.lastSeenDate = date;
                }
            });

            return Object.keys(historyObj.history).length > 0 ? historyObj : null;

        } catch (error) {
            console.error("AWS Roster Service: getGovernorHistory Error", error);
            throw error;
        }
    }

    async loadScanDetails(kingdomId, scanDate) {
        if (!this.db || !this.connected) throw new Error('Not connected to AWS');

        const safeDate = String(scanDate).replace(/[.#$\/\[\]\s]/g, "_");

        try {
            // Fetch Headers
            const headerParams = {
                TableName: this.tableName,
                KeyConditionExpression: 'PK = :pk AND SK = :sk',
                ExpressionAttributeValues: {
                    ':pk': `SCAN_HEADERS#${kingdomId}#${safeDate}`,
                    ':sk': 'HEADERS'
                }
            };
            const headRes = await this.db.query(headerParams).promise();
            const headers = headRes.Items && headRes.Items.length > 0 ? headRes.Items[0].attributes : null;

            // Fetch the massive governor list
            const scanParams = {
                TableName: this.tableName,
                KeyConditionExpression: 'PK = :pk',
                ExpressionAttributeValues: {
                    ':pk': `SCAN#${kingdomId}#${safeDate}`
                }
            };

            let allGovs = [];
            let lastEvaluatedKey = null;

            // Handle DynamoDB pagination for queries > 1MB
            do {
                if (lastEvaluatedKey) scanParams.ExclusiveStartKey = lastEvaluatedKey;
                const result = await this.db.query(scanParams).promise();

                if (result.Items) {
                    // Turn them back into an object keyed by ID
                    result.Items.forEach(i => {
                        allGovs.push(i.attributes);
                    });
                }
                lastEvaluatedKey = result.LastEvaluatedKey;
            } while (lastEvaluatedKey);

            return {
                data: allGovs,
                headers: headers
            };
        } catch (e) {
            console.error("AWS loadScanDetails error:", e);
            throw e;
        }
    }

    async getGovernorTimeline(govId) {
        if (!this.db || !this.connected) return null;
        try {
            const params = {
                TableName: this.tableName,
                KeyConditionExpression: 'PK = :pk',
                ExpressionAttributeValues: {
                    ':pk': `GOV_HISTORY#${govId}`
                }
            };
            const result = await this.db.query(params).promise();
            // Map the history chunks
            let historyObj = {};
            if (result.Items) {
                result.Items.forEach(i => {
                    const kid_date = i.SK.replace('SCAN#', '');
                    historyObj[kid_date] = i.attributes;
                });
            }

            // Get profile
            const profParams = {
                TableName: this.tableName,
                KeyConditionExpression: 'PK = :pk AND SK = :sk',
                ExpressionAttributeValues: {
                    ':pk': `GOV_PROFILE#${govId}`,
                    ':sk': 'PROFILE'
                }
            };
            const profRes = await this.db.query(profParams).promise();
            const profile = profRes.Items && profRes.Items.length > 0 ? profRes.Items[0].attributes : {};

            return {
                profile,
                history: historyObj
            };

        } catch (error) {
            console.error("AWS Error fetching governor timeline:", error);
            return null;
        }
    }

    // Attempt to search by exact ID, otherwise search by name 
    async universalGovernorSearch(query) {
        if (!this.db || !this.connected) return null;
        try {
            const exactRegex = new RegExp(`^ ${query} $`, 'i');

            // Searching arbitrary global profiles requires a Table Scan in AWS DynamoDB 
            // since we do not have a GSI set up.
            // Warning: Expensive operation in large AWS Tables.
            const params = {
                TableName: this.tableName,
                FilterExpression: 'begins_with(PK, :prefix) AND (contains(attributes.#n, :q) OR contains(SK, :q))',
                ExpressionAttributeNames: {
                    '#n': 'name' // 'name' could be a reserved word depending on dynamo strictness
                },
                ExpressionAttributeValues: {
                    ':prefix': 'GOV_PROFILE#',
                    ':q': String(query)
                }
            };

            const result = await this.db.scan(params).promise();
            let matches = [];

            if (result.Items) {
                for (const item of result.Items) {
                    const prof = item.attributes;
                    const id = item.PK.replace('GOV_PROFILE#', '');

                    if (exactRegex.test(prof.name) || String(id) === String(query)) {
                        matches.push({
                            id: id,
                            name: prof.name || 'Unknown',
                            lastSeenKingdom: prof.lastSeenKingdom || 'Unknown',
                            lastSeenDate: prof.lastSeenDate || 'Unknown'
                        });
                    }
                }
            }

            if (matches.length > 0) return matches[0];
            return null;

        } catch (e) {
            console.error("AWS Search Error", e);
            return null;
        }
    }

    async wipeDatabase() {
        if (!this.db || !this.connected) {
            throw new Error('Not connected to AWS. Please configure your settings.');
        }

        try {
            // Need the raw dynamodb client for table operations, not the DocumentClient
            const rawDb = new AWS.DynamoDB();

            // 1. Delete the table
            await rawDb.deleteTable({ TableName: this.tableName }).promise();
            console.warn(`AWS DYNAMODB TABLE '${this.tableName}' HAS BEEN DELETED.`);

            // 2. Wait for it to finish deleting (can take a few seconds)
            await rawDb.waitFor('tableNotExists', { TableName: this.tableName }).promise();

            // 3. Recreate the table with the exact same Unity schema
            const createParams = {
                TableName: this.tableName,
                KeySchema: [
                    { AttributeName: "PK", KeyType: "HASH" },  // Partition key
                    { AttributeName: "SK", KeyType: "RANGE" }  // Sort key
                ],
                AttributeDefinitions: [
                    { AttributeName: "PK", AttributeType: "S" },
                    { AttributeName: "SK", AttributeType: "S" }
                ],
                BillingMode: "PAY_PER_REQUEST"
            };

            await rawDb.createTable(createParams).promise();
            console.log(`AWS DYNAMODB TABLE '${this.tableName}' HAS BEEN RECREATED.`);

            // 4. Wait for it to become ACTIVE before allowing writes again
            await rawDb.waitFor('tableExists', { TableName: this.tableName }).promise();

            return true;
        } catch (error) {
            console.error('DynamoDB Wipe Error:', error);
            throw new Error('Failed to wipe table: ' + error.message);
        }
    }

    // ------------------------------------------------------------------------
    // GLOBAL WIPE LOCK
    // ------------------------------------------------------------------------
    async getWipeLock() {
        if (!this.db || !this.connected) return null;
        try {
            const params = {
                TableName: this.tableName,
                Key: {
                    PK: 'CONFIG',
                    SK: 'wipeLock'
                }
            };
            const result = await this.db.get(params).promise();
            return result.Item ? result.Item.value : null;
        } catch (error) {
            console.error('AWS Fetch Wipe Lock Error:', error);
            return null;
        }
    }

    async setWipeLock(password) {
        if (!this.db || !this.connected) throw new Error('Not connected to AWS.');
        try {
            if (password) {
                const params = {
                    TableName: this.tableName,
                    Item: {
                        PK: 'CONFIG',
                        SK: 'wipeLock',
                        value: password,
                        updatedAt: new Date().toISOString()
                    }
                };
                await this.db.put(params).promise();
            } else {
                const params = {
                    TableName: this.tableName,
                    Key: {
                        PK: 'CONFIG',
                        SK: 'wipeLock'
                    }
                };
                await this.db.delete(params).promise();
            }
            return true;
        } catch (error) {
            console.error('AWS Set Wipe Lock Error:', error);
            throw error;
        }
    }
}
