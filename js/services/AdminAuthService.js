class AdminAuthService {
    constructor(dataService) {
        this.dataService = dataService;
        this.adminPanel = document.getElementById('admin');
        this.adminLockScreen = document.getElementById('admin-lock-screen');
        this.adminAccessScreen = document.getElementById('admin-access-screen');
        this.passcodeInput = document.getElementById('adminPasscode');
        this.unlockBtn = document.getElementById('adminUnlockBtn');

        this.generateBtn = document.getElementById('generateTempAwsBtn');
        this.tempAwsFeedback = document.getElementById('tempAwsFeedback');
        this.tempCredentialsOutput = document.getElementById('tempAwsCredentialsOutput');
        this.tempAccessKeyEl = document.getElementById('tempAccessKeyDisplay');
        this.tempSecretKeyEl = document.getElementById('tempSecretKeyDisplay');
        this.tempExpirationEl = document.getElementById('tempExpirationDisplay');

        this.expirySelect = document.getElementById('tempAwsExpiry');
        this.customDaysInput = document.getElementById('tempAwsCustomDays');
        this.customDaysLabel = document.getElementById('tempAwsCustomLabel');

        // Admin Master Credentials
        this.adminAwsAccessKey = document.getElementById('adminAwsAccessKey');
        this.adminAwsSecretKey = document.getElementById('adminAwsSecretKey');
        this.saveAdminAwsConfigBtn = document.getElementById('saveAdminAwsConfigBtn');
        this.adminAwsFeedback = document.getElementById('adminAwsFeedback');

        // Security: We store a simple hash instead of the plaintext passcode
        // The default passcode "3418" computes to the hash 1570888
        this.PASSCODE_HASH = 1570888;

        this.initEventListeners();
    }

    initEventListeners() {
        if (!this.adminPanel) return;

        // Unlock Screen
        if (this.unlockBtn && this.passcodeInput) {
            this.unlockBtn.addEventListener('click', () => this.attemptUnlock());
            this.passcodeInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.attemptUnlock();
            });
        }

        // Generate Buttons
        if (this.generateBtn) {
            this.generateBtn.addEventListener('click', () => this.generateTemporaryAWSKey());
        }

        // Expiry Dropdown Interaction
        if (this.expirySelect && this.customDaysInput) {
            this.expirySelect.addEventListener('change', (e) => {
                if (e.target.value === 'custom') {
                    this.customDaysInput.style.display = 'inline-block';
                    if (this.customDaysLabel) this.customDaysLabel.style.display = 'inline-block';
                } else {
                    this.customDaysInput.style.display = 'none';
                    if (this.customDaysLabel) this.customDaysLabel.style.display = 'none';
                }
            });
        }

        // Save Admin Master Credentials
        if (this.saveAdminAwsConfigBtn) {
            this.saveAdminAwsConfigBtn.addEventListener('click', () => {
                const config = {
                    accessKey: this.adminAwsAccessKey.value.trim(),
                    secretKey: this.adminAwsSecretKey.value.trim()
                };
                if (!config.accessKey || !config.secretKey) {
                    this.adminAwsFeedback.textContent = '❌ Please provide both Access and Secret keys.';
                    this.adminAwsFeedback.style.color = 'var(--danger-color)';
                    return;
                }
                localStorage.setItem('admin_aws_master_config', JSON.stringify(config));
                this.adminAwsFeedback.textContent = '✅ Master Credentials Saved securely to local storage.';
                this.adminAwsFeedback.style.color = 'var(--success-color)';
                setTimeout(() => { this.adminAwsFeedback.textContent = ''; }, 3000);
            });
        }
    }

    hashPasscode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0; // Convert to 32bit integer
        }
        return hash;
    }

    attemptUnlock() {
        const code = this.passcodeInput.value.trim();
        const hashedInput = this.hashPasscode(code);

        if (hashedInput === this.PASSCODE_HASH) {
            this.adminLockScreen.style.display = 'none';
            this.adminAccessScreen.style.display = 'block';

            // Load saved admin credentials if they exist
            const savedAdminConfig = JSON.parse(localStorage.getItem('admin_aws_master_config')) || {};
            if (savedAdminConfig.accessKey) this.adminAwsAccessKey.value = savedAdminConfig.accessKey;
            if (savedAdminConfig.secretKey) this.adminAwsSecretKey.value = savedAdminConfig.secretKey;

            // Check if AWS is configured (either admin or general)
            if (!savedAdminConfig.accessKey && (!this.dataService.state.awsConfig || !this.dataService.state.awsConfig.accessKeyId)) {
                this.tempAwsFeedback.textContent = "Warning: Main AWS Credentials are not configured in Settings or Admin Panel.";
                this.tempAwsFeedback.style.color = "var(--warning-color)";
            }
        } else {
            this.tempAwsFeedback.textContent = "Incorrect Passcode.";
            this.tempAwsFeedback.style.color = "var(--danger-color)";
            this.passcodeInput.value = '';
            setTimeout(() => { this.tempAwsFeedback.textContent = ''; }, 2000);
        }
    }

    async generateTemporaryAWSKey() {
        let expirationDays = 7; // Default
        if (this.expirySelect) {
            if (this.expirySelect.value === 'custom') {
                const customVal = parseInt(this.customDaysInput.value);
                if (customVal && customVal > 0 && customVal <= 365) {
                    expirationDays = customVal;
                } else {
                    this.tempAwsFeedback.textContent = "❌ Please enter a valid number of days (1-365).";
                    this.tempAwsFeedback.style.color = "var(--danger-color)";
                    return;
                }
            } else {
                expirationDays = parseInt(this.expirySelect.value) || 7;
            }
        }

        this.tempAwsFeedback.textContent = `Generating temporary ${expirationDays}-day credentials... Please wait.`;
        this.tempAwsFeedback.style.color = "var(--accent-primary)";
        this.generateBtn.disabled = true;
        this.tempCredentialsOutput.style.display = 'none';

        try {
            const adminConfig = JSON.parse(localStorage.getItem('admin_aws_master_config'));
            const generalConfig = JSON.parse(localStorage.getItem('aws_dynamo_config')) || {};

            if (!adminConfig || !adminConfig.accessKey) {
                this.tempAwsFeedback.textContent = "❌ Please configure and save your Master IAM Credentials above first.";
                this.tempAwsFeedback.style.color = "var(--danger-color)";
                this.generateBtn.disabled = false;
                return;
            }

            if (!generalConfig || !generalConfig.tableName || !generalConfig.region) {
                this.tempAwsFeedback.textContent = "❌ Global AWS Settings (Region & Table Name) are missing from the main Settings tab.";
                this.tempAwsFeedback.style.color = "var(--danger-color)";
                this.generateBtn.disabled = false;
                return;
            }

            // 1. Initialize AWS IAM Object exclusively using the ADMIN master credentials
            AWS.config.update({
                accessKeyId: adminConfig.accessKey,
                secretAccessKey: adminConfig.secretKey,
                region: generalConfig.region || 'us-east-1'
            });

            const iam = new AWS.IAM();
            const tableName = generalConfig.tableName;

            // 2. Generate Unique User Name
            const randomId = Math.random().toString(36).substring(2, 8).toUpperCase();
            const userName = `Unity_Temp_Analyst_${randomId}`;

            // 3. Create the User
            this.tempAwsFeedback.textContent = `Creating IAM User: ${userName}...`;
            await iam.createUser({ UserName: userName }).promise();

            // 4. Create Access Keys for the new user
            this.tempAwsFeedback.textContent = `Generating Access Keys...`;
            const keyResponse = await iam.createAccessKey({ UserName: userName }).promise();
            const accessKeyId = keyResponse.AccessKey.AccessKeyId;
            const secretAccessKey = keyResponse.AccessKey.SecretAccessKey;

            // 5. Generate Variable Expiration Date (UTC)
            const expirationDate = new Date();
            expirationDate.setDate(expirationDate.getDate() + expirationDays);
            const expirationISO = expirationDate.toISOString();

            // 6. Define & Attach Inline Policy
            this.tempAwsFeedback.textContent = `Attaching ${expirationDays}-day restriction policy...`;

            // Get Account ID from caller identity to build the exact ARN
            const sts = new AWS.STS();
            const callerIdentity = await sts.getCallerIdentity().promise();
            const accountId = callerIdentity.Account;
            const tableArn = `arn:aws:dynamodb:${generalConfig.region}:${accountId}:table/${tableName}`;

            const policyDocument = {
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Effect": "Allow",
                        "Action": [
                            "dynamodb:PutItem",
                            "dynamodb:GetItem",
                            "dynamodb:Scan",
                            "dynamodb:Query",
                            "dynamodb:UpdateItem"
                        ],
                        "Resource": tableArn,
                        "Condition": {
                            "DateLessThan": {
                                "aws:CurrentTime": expirationISO
                            }
                        }
                    }
                ]
            };

            await iam.putUserPolicy({
                UserName: userName,
                PolicyName: `AutoExpiringDynamoAccess_${expirationDays}Days`,
                PolicyDocument: JSON.stringify(policyDocument)
            }).promise();

            // 7. Success! Display to user
            this.tempAwsFeedback.textContent = `✅ Temporary credentials successfully generated and restricted to ${expirationDays} days!`;
            this.tempAwsFeedback.style.color = "var(--success-color)";

            this.tempAccessKeyEl.textContent = accessKeyId;
            this.tempSecretKeyEl.textContent = secretAccessKey;
            this.tempExpirationEl.textContent = expirationDate.toLocaleString();

            this.tempCredentialsOutput.style.display = 'block';

        } catch (error) {
            console.error("AWS IAM Error:", error);

            if (error.code === 'AccessDenied') {
                this.tempAwsFeedback.textContent = "❌ Access Denied: Your main AWS key in Settings does not have permission to create IAM users (iam:CreateUser).";
            } else {
                this.tempAwsFeedback.textContent = `❌ Error: ${error.message}`;
            }
            this.tempAwsFeedback.style.color = "var(--danger-color)";
        } finally {
            this.generateBtn.disabled = false;
        }
    }
}

window.AdminAuthService = AdminAuthService;
