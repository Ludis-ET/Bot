import { useCallback, useEffect, useRef, useState } from "react";
import { ref, onValue } from "firebase/database";
import { realDb, db } from "../../../firebaseConfig";
import {
  collection,
  addDoc,
  query,
  orderBy,
  getDocs,
} from "firebase/firestore";
import { generateRandomPrompt } from "../../../utils/GenerateP";
import { calculateWPMAndAccuracy } from "../../../utils/CalculateWPM";
import { useAuth } from "../../../context";
import { UserInput } from "../single/UserInput";
import { PromptDisplay } from "../single/PromptDisplay";

interface GameProps {
  roomId: string;
  roomtype: string;
}

interface PlayerResult {
  username: string;
  wpm: number;
  accuracy: string;
}

export const Game = ({ roomId, roomtype }: GameProps) => {
  const [roomInfo, setRoomInfo] = useState<{
    creatorName: string;
    diff: string;
    duration: string;
    status: string;
    users: string[];
  } | null>(null);
  const { user } = useAuth();
  const [countdown, setCountdown] = useState(20);
  const [userInput, setUserInput] = useState<string>("");
  const [promptText, setPromptText] = useState<string>("");
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [wpm, setWPM] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<PlayerResult[]>([]);
  const textContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (roomtype === "random") {
      const roomRef = ref(realDb, `randomrooms/${roomId}`);
      onValue(roomRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setRoomInfo({
            creatorName: data.creatorName,
            diff: data.diff,
            duration: data.duration,
            status: data.status,
            users: Object.values(data.users || {}),
          });
        }
      });
    }
  }, [roomId, roomtype]);

  const durationInSeconds = roomInfo
    ? parseInt(roomInfo.duration.split(" ")[0]) *
      (roomInfo.duration.split(" ")[1] === "min" ? 60 : 1)
    : 0;

  const [timeLeft, setTimeLeft] = useState<number>(durationInSeconds + 21);

  useEffect(() => {
    if (roomInfo?.status === "in-progress" && countdown > 0) {
      const timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [roomInfo, countdown]);

  useEffect(() => {
    if (roomInfo) {
      setPromptText(generateRandomPrompt(roomInfo.diff, durationInSeconds));
    }
  }, [roomInfo, durationInSeconds]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (timeLeft > 0 && !gameOver) {
        setTimeLeft((prev) => prev - 1);
      } else if (timeLeft <= 0) {
        setGameOver(true);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [gameOver, timeLeft]);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const resultsRef = collection(db, `randomrooms/${roomId}/results`);
      const q = query(
        resultsRef,
        orderBy("accuracy", "desc"),
        orderBy("wpm", "desc")
      );
      const querySnapshot = await getDocs(q);

      const leaderboardData: PlayerResult[] = [];
      querySnapshot.forEach((doc) => {
        leaderboardData.push(doc.data() as PlayerResult);
      });
      setLeaderboard(leaderboardData);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
    }
  }, [roomId]);

  const saveResultToFirestore = useCallback(
    async (result: PlayerResult) => {
      try {
        const resultsRef = collection(db, `randomrooms/${roomId}/results`);
        await addDoc(resultsRef, result);
        fetchLeaderboard();
      } catch (error) {
        console.error("Error saving result to Firestore:", error);
      }
    },
    [roomId, fetchLeaderboard]
  );

  useEffect(() => {
    if (gameOver && roomInfo) {
      const endTime = Date.now();
      const timeTaken = startTime ? (endTime - startTime) / 1000 : 0;
      const { wpm: calculatedWPM, accuracy: calculatedAccuracy } =
        calculateWPMAndAccuracy(
          userInput,
          promptText,
          timeTaken,
          roomInfo.diff as string
        );

      setWPM(calculatedWPM);
      setAccuracy(calculatedAccuracy);

      saveResultToFirestore({
        username: user?.username || "",
        wpm: calculatedWPM,
        accuracy: calculatedAccuracy,
      });
    }
  }, [
    user,
    gameOver,
    userInput,
    promptText,
    startTime,
    roomInfo,
    saveResultToFirestore,
  ]);

  if (!roomInfo) {
    return <p>Loading room information...</p>;
  }

  return (
    <div className="p-6 text-white bg-gray-800 rounded-lg shadow-lg max-w-screen-lg mx-auto">
      <h2 className="text-2xl font-bold mb-4 text-center">
        Game Room: {roomId}
      </h2>
      {roomInfo.status === "in-progress" && countdown > 0 && (
        <div className="mb-4 space-y-2">
          <p>Room Type: {roomtype}</p>
          <p>Creator: {roomInfo.creatorName}</p>
          <p>Difficulty: {roomInfo.diff}</p>
          <p>Duration: {roomInfo.duration}</p>
          <p>Status: {roomInfo.status}</p>
        </div>
      )}
      <div className="mb-6">
        <h3 className="text-lg font-semibold">Players:</h3>
        <div className="flex flex-wrap gap-2 mt-2">
          {roomInfo.users.map((username, index) => (
            <div key={index} className="bg-gray-700 p-2 rounded text-sm">
              {username}
            </div>
          ))}
        </div>
      </div>

      {roomInfo.status === "in-progress" && countdown > 0 ? (
        <p className="text-center text-lg font-semibold">
          Starting in: <span className="text-yellow-300">{countdown}</span>{" "}
          seconds
        </p>
      ) : (
        <div className="mt-4">
          <p className="mb-2 text-yellow-300">Time Left: {timeLeft} sec</p>
          <div
            ref={textContainerRef}
            className="bg-gray-900 w-full p-4 rounded-md outline-none max-h-48 overflow-y-auto"
          >
            <PromptDisplay promptText={promptText} userInput={userInput} />
          </div>
          <UserInput
            userInput={userInput}
            setUserInput={setUserInput}
            gameOver={gameOver}
            setStartTime={setStartTime}
            promptText={promptText}
            setGameOver={setGameOver}
          />
          {gameOver && (
            <div className="mt-4 text-center">
              <p>Your WPM: {wpm}</p>
              <p>Your Accuracy: {accuracy}</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-8">
        <h3 className="text-lg font-semibold">Leaderboard</h3>
        <ul className="space-y-1">
          {leaderboard.map((player, index) => (
            <li key={index} className="text-sm">
              {player.username} - WPM: {player.wpm}, Accuracy: {player.accuracy}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
