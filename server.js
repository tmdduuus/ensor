const express = require('express');
const cors = require('cors');
const session = require('express-session');
const axios = require('axios');
const mysql = require('mysql2');
const jwt = require('jsonwebtoken');
const secretKey = '0307';
const http = require('http');

const app = express();

app.use(session({
  secret: '0307', // 세션 암호화를 위한 비밀키
  resave: false, // 세션 데이터의 저장 여부를 지정
  saveUninitialized: false, // 초기화되지 않은 세션을 저장 여부를 지정
}));

app.use(cors({
  origin: '*', // 모든 출처 허용 옵션. true 를 써도 된다.
}));

// MySQL 연결 설정
const connection = mysql.createConnection({
  host     : 'database-ensor.cufcntrxete1.ap-northeast-2.rds.amazonaws.com',
  user     : 'admin',
  password : 'ensorsm2023',
  database : 'ensor',
  port : '3306'
});

app.use(express.json());
app.get('/', function(req, res){
  res.send('ensor');
})

var kakaoUser;

// 로그인
app.post('/login', async (req, res) => {
    const { accessToken } = req.body;
    
    try {
      // 카카오 API를 통해 사용자 정보 요청
      const userInfo = await getKakaoUserInfo(accessToken);
      console.log(userInfo);
  
      // 사용자 정보를 활용하여 로그인 또는 회원가입 처리
      const user = await handleLoginOrSignup(userInfo);
      console.log(user);
      //JWT 토큰 생성
      const token = jwt.sign({ userId: userInfo.id }, secretKey, { expiresIn: '1h' });

      req.session.kakaoUserInfo = {
        // 카카오 로그인 정보
        accessToken : accessToken,
        kakao_id: userInfo.id,
        nickname: user.nickname,
        email: user.email
      };  
      
      kakaoUser = {
        // 카카오 로그인 정보
        accessToken : accessToken,
        kakao_id: userInfo.id,
        nickname: user.nickname,
        email: user.email
      };  

      // 로그인 또는 회원가입 성공 후 응답
      res.status(200).json({ success: true, message: 'Login successful', user, token });
    } catch (error) {
      // 에러 처리
      console.error('Failed to process login:', error);
      res.status(500).json({ success: false, message: 'Failed to process login' });
    }
});

// 로그아웃
app.post('/logout', (req, res) => {
  const kakaoUserInfo = req.session.kakaoUserInfo;

  // 카카오 API를 호출하여 로그아웃 요청
  axios.post('https://kapi.kakao.com/v1/user/logout', null, {
    headers: {
      Authorization: `Bearer ${kakaoUserInfo.accessToken}`
    }
  })
    .then(() => {
      // 로그아웃 성공 처리
      delete req.session.kakaoUserInfo;
      kakaoUser = "";
      res.status(200).json({ message: 'Logout successful' });
      console.log("로그아웃");
    })
    .catch(error => {
      // 로그아웃 실패 처리
      console.error('Logout error:', error);
      res.status(500).json({ error: 'Logout failed' });
    });
    
    // 세션에서 카카오 로그인 정보를 제거
    delete req.session.kakaoUserInfo;
    kakaoUser = "";
    /*
    // 카카오 로그아웃 URL 생성
    const kakaoLogoutUrl = `https://kauth.kakao.com/oauth/logout?client_id=YOUR_CLIENT_ID&logout_redirect_uri=YOUR_LOGOUT_REDIRECT_URI`;

    // 클라이언트에게 로그아웃 URL 반환
    res.json({ logoutUrl: kakaoLogoutUrl }); */
    
});

// 회원탈퇴
app.post('/withdrawal', (req, res) => {
    const kakaoUserInfo = req.session.kakaoUserInfo;
    
    // 카카오 API를 호출하여 회원 탈퇴 요청
    axios.post('https://kapi.kakao.com/v1/user/unlink', null, {
      headers: {
        Authorization: `Bearer ${kakaoUserInfo.accessToken}`
      }
    })
    .then(() => {
        // 사용자 정보 삭제 쿼리 실행
        const deleteFromSavelistQuery = 'DELETE FROM savelist WHERE kakao_id = ?';
        const deleteFromUserQuery = 'DELETE FROM user WHERE kakao_id = ?';

        connection.query(deleteFromSavelistQuery, kakaoUserInfo.kakao_id, (err, result) => {
        if (err) {
          // 삭제 실패 시 에러 처리
          console.log('Failed to delete user from savelist');
        }else{
          // savelist 삭제 성공 처리
          console.log('savelist에서 user 삭제 성공');
          // user 테이블에서 사용자 정보 삭제
          connection.query(deleteFromUserQuery, kakaoUserInfo.kakao_id, (error, deleteUserResult) => {
          if (error) {
            console.error('user 테이블에서 삭제 실패');
          }
          console.log('user 테이블에서 삭제 성공');
          console.log('회원탈퇴 성공');
        });
        }
        // 회원 탈퇴 성공 후 리다이렉트 등의 처리
        res.status(200).json({ success: true, message: 'Withdrawal successful' });
        });
        delete req.session.kakaoUserInfo;
        kakaoUser = "";
      })
      .catch(error => {
        // 회원 탈퇴 실패 처리
        res.status(500).json({ success: false, message: 'Failed to withdrawal' });
        console.error('Withdrawal error:', error);
      }); 
});

app.get('/mypage', (req, res) => {
  var kakaoUserInfo = req.session.kakaoUserInfo;
  // console.log("kakaoUserInfo : " + kakaoUserInfo);
  const email = kakaoUser.email;
  const nickname = kakaoUser.nickname;
  console.log("email : " + email + " nickname : " + nickname);
  console.log(kakaoUser);

  res.status(200).json({ email, nickname });
})
  
// 카카오 API를 통해 사용자 정보 요청
async function getKakaoUserInfo(accessToken) {
  try {
    const response = await axios.get('https://kapi.kakao.com/v2/user/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const userInfo = response.data;
    console.log(userInfo);
    return userInfo;
  } catch (error) {
    console.error('Failed to get user info from Kakao API:', error);
    throw error;
  }
}

// 사용자 정보를 활용하여 로그인 또는 회원가입 처리
async function handleLoginOrSignup(userInfo) {
  const { id, properties, kakao_account } = userInfo;

  return new Promise((resolve, reject) => {
    // MySQL 쿼리 실행
    connection.query('SELECT * FROM user WHERE kakao_id = ?', [id], async (error, results) => {
      if (error) {
        console.error('Failed to execute MySQL query:', error);
        reject(error);
      } else {
        let user;

        if (results.length > 0) {
          // 이미 등록된 사용자인 경우
          user = results[0];
        } else {
          // 새로운 사용자인 경우 회원가입 처리
          console.log(userInfo);
          const newUser = {
            kakao_id: id,
            nickname: properties.nickname,
            email: kakao_account.email
          };

          connection.query('INSERT INTO user SET ?', newUser, (error, result) => {
            if (error) {
              console.error('Failed to execute MySQL query:', error);
              reject(error);
            } else {
              newUser.id = result.insertId;
              user = newUser;
            }
          });
        }

        resolve(user);
      }
    });
  });
}

// 회원탈퇴 사용자 데이터 삭제
async function WithDrawalUser(userInfo){
    const { id, properties, kakao_account } = userInfo;

    return new Promise((resolve, reject) => {
        // 사용자 정보 삭제 쿼리
    
        connection.query(`DELETE FROM user WHERE kakao_id = ?`, [id], (error, results) => {
          if (error) {
            reject(error);
          } else {
            resolve(results);
            console.log("DELETE USER KAKAO_ID : " + id);
          }
        });
      });
}

async function getKakaoAccessToken(code) {
    try {
      const response = await axios.post('https://kauth.kakao.com/oauth/token', {
        grant_type: 'authorization_code',
        client_id: 'aaaf90b2d615d0c7779ef07484845f45',
        redirect_uri: 'http://localhost:8001/auth/kakao/callback',
        code: code,
      });
  
      const { access_token } = response.data;
      return access_token;
    } catch (error) {
      console.error('Failed to get Kakao access token:', error);
      throw error;
    }
  }
  

// MySQL 연결
connection.connect((error) => {
  if (error) {
    console.error('Failed to connect to MySQL:', error);
  } else {
    // 서버 시작
    app.listen(3000, () => {
      console.log('Server is running on port 3000');
    });
  }
});

//////////////////////////////////////////////////////

// 비건 인증 정보 목록 list
app.get('/list/vegan', (req, res) => {
    // MySQL에서 정보를 조회하는 쿼리
    const query = 'SELECT * FROM inform where category = 1';
  
    connection.query(query, (error, results) => {
      if (error) {
        console.error('Error) /list/vegan SQL 에러:', error);
        res.status(500).json({ error: 'Error) /list/vegan SQL 에러' });
      } else {
        res.status(200).json(results);
      }
    });
});

// 친환경 인증 정보 목록 list
app.get('/list/environment', (req, res) => {
    // MySQL에서 정보를 조회하는 쿼리
    const query = 'SELECT * FROM inform where category = 2';
  
    connection.query(query, (error, results) => {
      if (error) {
        console.error('Error) /list/environment SQL 에러 : ', error);
        res.status(500).json({ error: 'Error) /list/environment SQL 에러' });
      } else {
        res.status(200).json(results);
      }
    });
});

//////////////////////////////////////////

var Web3 = require("web3");
var web3 = new Web3(new Web3.providers.HttpProvider("http://127.0.0.1:8545"));
var hashabi = [
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "_hash",
				"type": "string"
			}
		],
		"name": "checkHash",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "_hash",
				"type": "string"
			}
		],
		"name": "getRating",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "_hash",
				"type": "string"
			}
		],
		"name": "saveHash",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "_hash",
				"type": "string"
			},
			{
				"internalType": "uint8",
				"name": "rate",
				"type": "uint8"
			}
		],
		"name": "voteProduct",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bytes32",
				"name": "",
				"type": "bytes32"
			}
		],
		"name": "hashDataMap",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "printHello",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "pure",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "printRating",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "printResult",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "_hash",
				"type": "string"
			}
		],
		"name": "printVoteNumber",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bytes32",
				"name": "",
				"type": "bytes32"
			}
		],
		"name": "productRating",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "rating",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "result",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bytes32",
				"name": "",
				"type": "bytes32"
			}
		],
		"name": "voteNumber",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
];
var hashContract = web3.eth.contract(hashabi);
var hash = hashContract.at("0xC42F95a13184EDF8fBBfcEb722C5DEda04605c6a");

// QR 코드 데이터에 해당하는 결과 조회
app.post('/censor', (req, res) => {
    const qrCodeData = req.body.qrCodeData;
    const codeNum = qrCodeData.slice(0, 5);

    // 블록체인 결과
    hash.checkHash(qrCodeData, {from : web3.eth.accounts[0]});
    const tfresult = hash.printResult.call();
    
    // MySQL 쿼리 실행
    const query = `SELECT * FROM inform WHERE censorID = ${codeNum}`;
  
    connection.query(query, (err, results) => {
      if (err) {
        console.error('Error) /censor SQL 에러:', err);
        res.status(500).json({ error: 'Error) /censor SQL 에러' });
      } else {
        const send = {tfresult, results};
        // 검색 결과 반환
        if(tfresult == "success"){
          // res.status(200).json({tfresult, results});
          res.send(send);
        }else if(tfresult == "failure"){
          res.status(200).json({tfresult});
        }else{
          res.status(500).json({message:"잘못된 데이터"});
        }
      }
    });
});

// 블록체인에 데이터 저장
app.post('/savehash', (req, res) =>{
  const hashData = req.body.hashData;

  hash.saveHash(hashData, {from : web3.eth.accounts[0]});
  res.send("success");
})

// qr코드 인증 정보 저장하기 (버튼)
app.post('/save', (req, res) => {
  const qrCodeData = req.body.qrCodeData;
  const codeNum = qrCodeData.slice(0, 5);
  const productName = qrCodeData.slice(5);
  console.log('[save] codeNum : ' + codeNum +' productName : ' + productName);
  const data = new Array(5);
 
  const kakaoUserInfo = req.session.kakaoUserInfo;
  
  connection.connect((error) => {
    if (error) {
      console.error('MySQL 연결 실패:', error);
      return;
    }
    console.log('MySQL 연결 성공');
  
    // SELECT 문 실행
    connection.query(`SELECT * FROM inform WHERE censorID = ${codeNum}`, (error, results) => {
      if (error) {
        console.error('Error) /save SELECT 문 실행 실패:', error);
        return;
      } else {
        console.log('조회된 데이터:', results);
        for (let i = 0; i < results.length; i++) {
          data[0] = results[i].censorID;
          data[1] = results[i].censorCom;
          data[2] = results[i].censorText;
          data[3] = results[i].imgUrl;
        }
      }
  
      const values = [kakaoUser.kakao_id, productName, data[0], data[1], data[2], data[3]];

      // SELECT 결과를 다른 테이블에 INSERT
      const insertQuery = `INSERT INTO savelist (kakao_id, productName, censorID, censorCom, censorText, imgUrl) VALUES (?, ?, ?, ?, ?, ?)`;
      
      connection.query(insertQuery, values, (error, results) => {
        if (error) {
          console.error('INSERT 문 실행 실패:', error);
          return;
        }else {
          // 검색 결과 반환
          res.json({message:"저장 성공", result : values});
        }
  
        console.log('INSERT 문 실행 성공');
  
      });
    });
  });

});

// 나의 인증 정보 목록
app.get('/savelist', (req, res) =>{
  const kakaoUserInfo = req.session.kakaoUserInfo;
  console.log(kakaoUser);
  
  // MySQL 쿼리 실행
  const query = `SELECT * FROM savelist WHERE kakao_id = ${kakaoUser.kakao_id}`;
  
  connection.query(query, (err, results) => {
    if (err) {
      console.error('Error) 나의 인증 정보 목록 SQL 에러 :', err);
      res.status(500).json({ error: 'Error) 나의 인증 정보 목록 SQL 에러' });
    } else {
      // 검색 결과 반환
      res.json(results);
    }
  });
})

// 후기 작성 (별점 + 리뷰)
app.post('/write', (req, res)=>{
	const product = req.body.product;
	const star = req.body.star;
  const review = req.body.review;

  // DB에 리뷰 등록
  const insertquery = `INSERT INTO review (kakao_id, nickname, product, review) VALUES (?, ?, ?, ?)`;
  const selectquery = `SELECT nickname, review FROM review WHERE product = '${product.slice(5)}' and kakao_id = '${kakaoUser.kakao_id}'`;
  const values = [kakaoUser.kakao_id, kakaoUser.nickname, product.slice(5), review];

  connection.query(selectquery, (error, results) => {
    if (error) {
        console.error('후기 작성 select 에러 발생:', error);
        connection.end();
        return;
    }

    if (results.length > 0) {
        console.log('이미 리뷰를 작성하였습니다.');
        res.status(202).send({ code : 202, message : "이미 리뷰를 작성하였습니다."});
    } else {
        // 블록체인에 별점 등록
	      hash.voteProduct(product, star, {from : web3.eth.accounts[0]});
        console.log("별점 등록 성공");
        // INSERT 문 실행
        connection.query(insertquery, values, (error) => {
            if (error) {
                console.error('후기 작성 INSERT 에러 발생:', error);
            } else {
                console.log("후기 작성 완료");
                res.status(201).send({ code : 201, message : "후기 작성 완료"});
            }
        });
    }
  });
  
})

// 리뷰 보기
app.get('/review', (req, res)=>{
	const product = req.query.product;
  
  const query = `SELECT nickname, review FROM review WHERE product = '${product.slice(5)}'`;
  connection.query(query, (err, results) => {
    if (err) {
      console.error('Error) 리뷰 보기 SQL 에러 :', err);
      res.status(500).json({ error: 'Error) 리뷰 보기 SQL 에러' });
    } else {
      // 검색 결과 반환
      res.json(results);
    }
  });
})

// 별점 보기
app.get('/rate', (req, res) =>{
	const product = req.query.product;

	hash.getRating(product, {from :web3.eth.accounts[0]});
	const result = hash.printRating.call();
  var message = "안전";
  if(result <= 2){
    message = "위험";
  }
	res.send({product : product.slice(5), rate : result, message : message});
})

// 블록체인에 별점 등록
app.post('/star', (req, res)=>{
  const product = req.body.product;
  const star = req.body.star;
  
  hash.voteProduct(product, star, {from : web3.eth.accounts[0]});
  console.log("별점 등록 성공");
  res.send("별점 등록 성공");
})

// 블록체인 통신 테스트
// var helloabi = [{"inputs":[],"name":"printHello","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"pure","type":"function"}];
// var helloContract = web3.eth.contract(helloabi, {from : web3.eth.accounts[0]});
// var hello = helloContract.at("0x289aC693d47Ab216992D05F8ebbb22f04fAfc6f3");

// app.get('/hello', (req, res)=>{
//   var result = hello.printHello.call();
//   res.send(result);
// })

