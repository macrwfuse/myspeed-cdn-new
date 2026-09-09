import LatestTestComponent from "./components/LatestTest";
import TestAreaComponent from "./components/TestArea";
import NetworkInfo from "./components/NetworkInfo";

const Home = () => (
    <div>
        <NetworkInfo />
        <LatestTestComponent/>

        <br />

        <TestAreaComponent/>
    </div>
)


export default Home;