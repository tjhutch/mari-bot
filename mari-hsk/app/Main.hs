{-# LANGUAGE OverloadedStrings, DeriveGeneric, RecordWildCards #-}

module Main where

import Prelude ()
import Prelude.Compat

import Control.Applicative (empty)
import Data.Aeson (FromJSON, ToJSON, decode, encode)
import Data.Aeson.TH (deriveJSON, defaultOptions)
import Data.Text (Text)
import Data.Int (Int64)
import GHC.Generics (Generic)
import qualified Data.ByteString.Lazy as BS

data CommandType = Voice | Text | Meme | Go | Stop | Move | Help | Leave | Broken deriving (Show, Generic, Eq)
data Command = Command {
    name     :: Text
  , typ      :: Text
  , folder   :: Maybe Text
  , files    :: Maybe [Text]
  , urls     :: Maybe [Text]
  , response :: Maybe Text
  } deriving (Show, Generic, Eq)

data Config = Config {
    token     :: Text
  , prefix    :: Text
  , commands  :: [Command]
  } deriving (Show, Generic, Eq)

instance FromJSON Command
instance ToJSON Command

instance FromJSON Config
instance ToJSON Config

main :: IO ()

first :: Show a => [a] -> a
first [] = error "Empty list"
first (a:_) = a

index :: Show a => Int -> [a] -> a
index i [] = error "Empty list"
index 0 lst = first lst
index i (a:b) = index (i-1) b

myLen :: Show a => [a] -> Int
myLen [] = 0
myLen (_:a) = 1 + (myLen a)

myRev :: Show a => [a] -> [a]
myRev = foldl (flip (:)) []

isPal :: (Eq a, Show a) => [a] -> Bool
isPal lst = lst == (myRev lst)

primeHelp a b | a == b        = True
              | mod b a == 0  = False
              | otherwise     = primeHelp (a + 1) b

isPrime a = primeHelp 2 a

main = do
  jsonFile <- BS.readFile "c:\\workspace\\mari-bot\\config-hsk.json"
  let req = decode jsonFile :: Maybe Config
  print req