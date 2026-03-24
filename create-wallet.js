const StellarSdk = require('@stellar/stellar-sdk');
const bip39 = require('bip39');
const { derivePath } = require('ed25519-hd-key');

// 명령행 인자 파싱
const args = process.argv.slice(2);
const isMainnet = args.includes('-mainnet');
const secretIndex = args.indexOf('-s');
const creatorSecret = secretIndex !== -1 && args[secretIndex + 1] ? args[secretIndex + 1] : null;

// 네트워크 설정
const horizonUrl = isMainnet ? 'https://api.minepi.com' : 'https://api.testnet.minepi.com';
const networkPassphrase = isMainnet ? 'Pi Network' : 'Pi Testnet';
const server = new StellarSdk.Horizon.Server(horizonUrl);

if (!creatorSecret) {
    console.error("오류: 시크릿키(-s)를 입력해주세요.");
    console.error(`사용법: node create-wallet.js [-mainnet] -s <SECRET_KEY>`);
    console.error("  -mainnet: 메인넷 네트워크 사용 (지정하지 않으면 테스트넷)");
    process.exit(1);
}

console.log(`네트워크: ${isMainnet ? 'Mainnet' : 'Testnet'}`);

async function createNewWallet() {

    try {
        // 생성자 키페어 로드
        const creatorKeyPair = StellarSdk.Keypair.fromSecret(creatorSecret);
        console.log("생성자 주소:", creatorKeyPair.publicKey());
        
        // 니모닉(비밀 구절) 생성 (24단어 - 256비트 엔트로피)
        const mnemonic = bip39.generateMnemonic(256);
        const seed = bip39.mnemonicToSeedSync(mnemonic);
        
        // 파생 경로 적용 (스텔라 표준 m/44'/148'/0')
        const derivationPath = "m/44'/148'/0'";
        const derivedKey = derivePath(derivationPath, seed.toString('hex')).key;
        
        // 새로운 지갑을 위한 키페어 도출
        const newKeyPair = StellarSdk.Keypair.fromRawEd25519Seed(derivedKey);

        console.log("\n=== 새로운 지갑 키페어 생성 완료 ===");
        console.log("비밀 구절(Passphrase):", mnemonic);
        console.log("공개키(Public Key):", newKeyPair.publicKey());
        console.log("시크릿키(Secret Key):", newKeyPair.secret());
        console.log("====================================\n");

        if (!isMainnet)
        {
            console.log("생성자 계정 정보를 파이 테스트넷에서 불러오는 중...");
        }
        else 
        {
            console.log("생성자 계정 정보를 파이 메인넷에서 불러오는 중...");
        }
        
        const creatorAccount = await server.loadAccount(creatorKeyPair.publicKey());
        
        // 트랜잭션 빌더 설정 (Create Account Operation)
        console.log("트랜잭션 생성 중... (초기 잔액 1 Pi 지급)");
        const transaction = new StellarSdk.TransactionBuilder(creatorAccount, {
            fee: "100000", // 파이 네트워크 기본 수수료 (0.01 Pi)
            networkPassphrase: networkPassphrase
        })
        .addOperation(StellarSdk.Operation.createAccount({
            destination: newKeyPair.publicKey(),
            startingBalance: "1", // 1 Pi를 보내며 계정 생성
        }))
        .setTimeout(30) // 30초 타임아웃
        .build();
        
        // 생성자 지갑으로 서명
        transaction.sign(creatorKeyPair);
        
        // 트랜잭션 파이 네트워크에 제출
        console.log("트랜잭션을 네트워크에 제출하는 중...");
        const response = await server.submitTransaction(transaction);
        
        console.log("\n성공! 트랜잭션 해시:", response.hash);
        if (!isMainnet)
        {
            console.log("새로운 지갑이 파이 테스트넷에 성공적으로 생성되었으며 1 Pi가 충전되었습니다.");
        }
        else
        {
            console.log("새로운 지갑이 파이 메인넷에 성공적으로 생성되었으며 1 Pi가 충전되었습니다.");
        }
    } catch (error) {
        console.error("\n오류 발생:", error.message);
        if (error.response && error.response.data) {
            console.error("세부 오류 내용:", JSON.stringify(error.response.data.extras, null, 2));
        }
    }
}

createNewWallet();
